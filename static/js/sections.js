/** GROUPS **/

$(document).ready(function () {
    $('#netTbl tbody').on( 'click', 'tr', function () {
        $(this).toggleClass('selected');
    });
    $('#netTbl').DataTable({
        columnDefs: [{
            orderable: false,
            className: 'select-checkbox',
            targets: 0
        }],
        select: {
            style: 'os',
            selector: 'td:first-child'
        },
        order: [[1, 'asc']]
    });
});

function createGroup(){
    let paws = $.map($('#netTbl').DataTable().rows('.selected').data(), function (item) {return item[1];});
    if(paws.length == 0){ alert("You need to select some hosts!"); return;}
    let groupName = $("#groupNewName").val();
    restRequest('PUT', {"name":groupName,"paws":paws,"index":"core_group"}, alertCallback);
}

/** OPERATIONS **/

let atomic_interval = null;

function toggleOperationView(){
    if($('#togBtnOp').is(':checked')) {
        showHide('#queueName,#queueGroup,#queueFlow,#opBtn', '#operations');
    } else {
        showHide('#operations', '#queueName,#queueGroup,#queueFlow,#opBtn');
    }
}

function handleStartAction(){
    let name = document.getElementById("queueName").value;
    if(!name){alert('Please enter an operation name!'); return; }
    let queueDetails = {
        "index":"core_operation",
        "name":name,
        "group":document.getElementById("queueGroup").value,
        "adversary":document.getElementById("queueFlow").value
    };
    restRequest('PUT', queueDetails, alertCallback);
}

function refresh() {
    let selectedOperationId = $('#operations option:selected').attr('value');
    let postData = selectedOperationId ? {'index':'core_operation','id': selectedOperationId} : null;
    restRequest('POST', postData, operationCallback);
}

function operationCallback(data){
    let operation = data[0];
    let selectedOperationId = $('#operations option:selected').attr('value');
    if(operation.finish != null) {
        console.log("Turning off refresh interval for page");
        clearInterval(atomic_interval);
    } else {
        if(!atomic_interval) {
            console.log("Setting refresh interval for page");
            atomic_interval = setInterval(refresh, 5000);
        }
    }
    $("#dash-start").html(operation.start);
    $("#dash-finish").html(operation.finish);
    $("#dash-group").html(operation.host_group.name);
    $("#dash-flow").html(operation.adversary.name);

    $('.event').each(function() {
        let opId = $(this).attr('operation');
        if(opId && opId != selectedOperationId) {
            $(this).remove();
        }
    });
    for(let i=0;i<operation.chain.length;i++){
        if($("#" + operation.chain[i].id).length == 0) {
            let template = $("#link-template").clone();
            template.find('#link-description').html(operation.chain[i].abilityDescription);
            template.attr("id", operation.chain[i].id);
            template.attr("operation", operation.chain[i].op_id);
            template.attr("data-date", operation.chain[i].decide.split('.')[0]);
            template.find('#time-tactic').html('<p style="font-size: 13px;font-weight:100">Host #'
                + operation.chain[i].host_id +'... "'+operation.chain[i].abilityName +'"</p>');
            template.find('#time-action').html(atob(operation.chain[i].command));
            refreshUpdatableFields(operation.chain[i], template);
            template.find('#link-id').html(operation.chain[i].id);

            template.insertBefore("#time-start");
            $(template.find("#inner-contents")).slideUp();
            template.show();
        } else {
            let existing = $("#"+operation.chain[i].id);
            refreshUpdatableFields(operation.chain[i], existing);
        }
    }
}

function refreshUpdatableFields(chain, div){
    if(chain.collect)
        div.find('#link-collect').html(chain.collect.split('.')[0]);
    if(chain.finish)
        div.find('#link-finish').html(chain.finish.split('.')[0]);
    div.find('#link-status').html(chain.status);
}

function rollup(element) {
    let inner = $("#"+element.id).find("#inner-contents");
    if ($("#"+element.id).find("#inner-contents").is(":visible")) {
        $(inner).slideUp();
    } else {
        $(inner).slideDown();
    }
}

function findResults(){
    restRequest('POST', {'index':'core_result','link_id':$('#decisionResult').val()}, loadResults);
}

function loadResults(data){
    $('#resultView').html(atob(data[0].output));
}

/** ADVERSARIES **/

function toggleAdversaryView(){
    if($('#togBtnAdv').is(':checked')) {
        showHide('#profile-name', '#profile-existing-name');
    } else {
        showHide('#profile-existing-name', '#profile-name');
    }
}

function loadAdversary() {
    restRequest('POST', {'index':'core_adversary', 'name': $('#profile-existing-name').val()}, loadAdversaryCallback);
}

function loadAdversaryCallback(data) {
    $('#profile-name').val($('#profile-existing-name').val());
    $('#profile-description').val(data[0]['description']);
    $('#profile-tests').empty();
    $.each(data[0]['phases'], function(phase, abilities) {
        abilities.forEach(function(a) {
            $('#profile-tests').append(buildAbility(a.id, a.name, a.technique.tactic, a.test, a.parser, phase));
        });
    });
    refreshColorCodes();
}

function createAdversary() {
    let name = $('#profile-name').val();
    if(!name){alert('Please enter an adversary name!'); return; }
    let description = $('#profile-description').val();
    if(!description){alert('Please enter a description!'); return; }

    let abilities = [];
    $('#profile-tests li').each(function() {
        abilities.push({"id": $(this).attr('id'),"phase":$(this).data('phase')})
    });
    if(abilities.length == 0) {
        alert("You need to create some abilities!");
        return;
    }
    restRequest('PUT', {"name":name,"description":description,"phases":abilities,"index":"core_adversary"}, alertCallback);
}

function addAbility(exploits){
    let phase = $('#profile-phase').find(":selected").val();
    if(phase == 0){
        alert('No phase chosen!');
        return
    }
    let ability = null;
    exploits.forEach(function(a) {
        if(a.id == $('#testId').val()) {
            ability = a;
            return true;
        }
    });
    if(ability == null) {
        alert('No ability found!');
        return;
    }
    if($('#profile-tests #' + ability.id).length) {
        alert('The adversary already has this ability');
        return;
    }
    $('#adversary-profile').find('#profile-tests').append(buildAbility(ability.id, ability.name, ability.technique.tactic, ability.test, ability.parser, phase));
    refreshColorCodes();
    filterByPhase();
}

function removeAbility(test_id){
    $('#profile-tests #'+test_id).remove();
    refreshColorCodes();
}

function buildAbility(testId, testName, tactic, encodedTest, parser, phase){
    let requirements = buildRequirements(encodedTest);
    let li = $('<li/>')
        .attr('id', testId)
        .data('testId', testId)
        .data('phase', phase);
    let fieldset = $('<fieldset/>').addClass('ability-box')
        .data('parser', parser)
        .data('requirements', requirements)
        .appendTo(li);
    let legend = $('<legend/>').text('P'+phase + ':'+tactic).appendTo(fieldset);
    let span = $('<span/>').text(' RM');
    span.click(function() { removeAbility(testId); });
    span.appendTo(legend);
    let image = $('<p/>').text(testName);
    image.appendTo(fieldset);

    //add to filter
    if($('#phaseFilter #phase'+phase).length == 0) {
        $('#phaseFilter').append($("<option></option>")
        .attr("id",'phase'+phase)
        .attr("value",phase)
        .text('Phase '+phase));
    }
    return li;
}

function refreshColorCodes(){
    $('.ability-box').each(function() {
        let parser = [];
        $('.ability-box').each(function() {
            $(this).data('parser').forEach(function(item) {
                parser.push(item['property']);
            });
        });
        let difference = $(this).data('requirements').filter(x => !parser.includes(x));
        if(difference.length) {
            $(this).css('border', '2px solid red');
        } else {
            $(this).css('border', '2px solid green');
        }
    });
}

function filterByPhase(){
    let filter = $('#phaseFilter').val();
    for (let li of $("#profile-tests li")) {
        if(filter == 0 || filter == $(li).data('phase')) {
            $(li).show();
        } else {
            $(li).hide();
        }
    }
}

/** ABILITIES **/

$(document).ready(function () {
    $("#ability-property-filter option").val(function(idx, val) {
        $(this).siblings('[value="'+ val +'"]').remove();
    });
    $('#nextAbility').click(function() {
        $('#ability-test option:selected').next().attr('selected', 'selected');
        loadAbility();
    });
});

function triggerConditions(parsers) {
    parsers.forEach(function(element){
        if (element.script.length > 0){
            $('#preconditions').show();
            $('#postconditions').show();
            return true;
        }
    })
}

function populateTacticAbilities(exploits){
    let parent = $('#ability-profile');
    clearAbilityDossier();
    $(parent).find('#ability-test').empty().append("<option disabled='disabled' selected>Select ability</option>");

    let tactic = $(parent).find('#ability-tactic-filter').find(":selected").data('tactic');
    exploits.forEach(function(ability) {
        if(tactic == ability.technique.tactic)
            appendAbilityToList(tactic, ability);
    });
    $('#ability-property-filter').css('opacity',0.5);
    $('#ability-tactic-filter').css('opacity',1.0);
}

function appendAbilityToList(tactic, value) {
    $('#ability-profile').find('#ability-test').append($("<option></option>")
        .attr("value",value['name'])
        .attr("id",value['id'])
        .data("tactic", tactic)
        .data("technique", value['technique'])
        .data("name", value['name'])
        .data("description", value['description'])
        .data("test",value['test'])
        .data("parser",value['parser'])
        .text(value['name']));
}

function clearAbilityDossier(){
    $('#ability-profile .ability-table tr:last td:input,ol').each(function(){
        $(this).val('');
        $(this).empty();
    });
}

function loadAbility() {
    let parent = $('#ability-profile');
    clearAbilityDossier();

    let chosen = $('#ability-test option:selected');
    $(parent).find('#ability-id').val($(chosen).attr('id'));
    $(parent).find('#ability-name').val($(chosen).data('name'));
    $(parent).find('#ability-tactic').val($(chosen).data('technique')['tactic']);
    $(parent).find('#ability-technique-id').val($(chosen).data('technique')['attack_id']);
    $(parent).find('#ability-technique-name').val($(chosen).data('technique')['name']);
    $(parent).find('#ability-description').val($(chosen).data('description'));
    $(parent).find('#ability-command').html(atob($(chosen).data('test')));

    for(let k in $(chosen).data('parser')) {
        $(parent).find('#ability-postconditions').append('<li>'+$(chosen).data('parser')[k].property+'</li>');
        $(parent).find('#ability-fact-name').val($(chosen).data('parser')[k].fact);
        $(parent).find('#ability-fact-regex').val($(chosen).data('parser')[k].regex);
    }
    let requirements = buildRequirements($(chosen).data('test'));
    for(let k in requirements) {
        $(parent).find('#ability-preconditions').append('<li>'+requirements[k]+'</li>');
    }
}

function createAbility(){
    let parent = $('#ability-profile');
    let id = $(parent).find('#ability-id').val();
    if(id == '') {
        alert('You must select an existing ability to update!');
        return;
    }
    let postData = {
        "index": "core_ability",
        "id": $(parent).find('#ability-id').val(),
        "name": $(parent).find('#ability-name').val(),
        "description": $(parent).find('#ability-description').val(),
        "executors": [],
        "tactic": $(parent).find('#ability-tactic').val(),
        "technique": {
          "attack_id": $(parent).find('#ability-technique-id').val(),
          "name": $(parent).find('#ability-technique-name').val()
        },
        "test": btoa($(parent).find('#ability-command').val())
    };
    restRequest('PUT', postData, alertCallback);
}

function buildRequirements(encodedTest){
    let matchedRequirements = atob(encodedTest).match(/#{([^}]+)}/g);
    if(matchedRequirements) {
        matchedRequirements = matchedRequirements.filter(function(e) { return e !== '#{server}' });
        matchedRequirements = matchedRequirements.filter(function(e) { return e !== '#{group}' });
        matchedRequirements = [...new Set(matchedRequirements)];
        return matchedRequirements.map(function(val){
           return val.replace(/[#{}]/g, "");
        });
    }
    return [];
}