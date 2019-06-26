/** GROUPS **/

let agent_interval_time = 30000;
let agent_interval = null;

$(document).ready(function () {
    $('#netTbl').DataTable({
        ajax: {
            url: '/plugin/chain/rest',
            type: 'POST',
            contentType: 'application/json',
            dataType: 'json',
            data: function(d) {
	            return JSON.stringify({"index": "core_agent"});
			},
            dataSrc: ''
        },
        columnDefs:[
            {
                targets: 0,
                data: null,
                className: 'select-checkbox',
                orderable: false,
                sDefaultContent: ''
            },
            {
                targets: 1,
                data: null,
                render: {
                    "_" : "paw"
                }
            },
            {
                targets: 2,
                data: null,
                render: {
                    "_" : "checks"
                }
            },
            {
                targets: 3,
                data: null,
                fnCreatedCell: function(td, cellData, rowData, row, col){
                    $(td).addClass('tag');
                },
                render: function(data,type,row,meta){
                    let g = "";
                    data['groups'].forEach(function(e){
                        g += e['name'] + " ";
                    });
                    return g;
                }
            },
            {
                targets: 4,
                data: null,
                render: {
                    "_" : "platform"
                }
            },
            {
                targets: 5,
                data: null,
                render: {
                    "_" : "last_seen"
                }
            }
        ],
        select: {
			style: 'os',
			selector: 'td:first-child'
		},
        order: [[1, 'asc']],
        errMode: 'throw'
    });
    $('#netTbl tbody').on( 'click', 'tr', function () {
        $(this).toggleClass('selected');
    });
    agent_interval = setInterval(agent_refresh, agent_interval_time);
});

function createGroup(){
    let paws = $.map($('#netTbl').DataTable().rows('.selected').data(), function (item) {return item['paw'];});
    if(paws.length == 0){ alert("You need to select some hosts!"); return;}
    let groupName = $("#groupNewName").val();
    restRequest('PUT', {"name":groupName,"paws":paws,"index":"core_group"}, createGroupCallback);
}

function createGroupCallback(data){
    agent_refresh();
}

function reloadGroupElements(data){
    let gp_elem = $("#queueGroup");
    $.each(data, function(index, gp) {
        if(!gp_elem.find('option[value="'+gp.id+'"]').length > 0){
            gp_elem.append("<option id='qgroup-" + gp.name + "' value='" + gp.id + "'>" + gp.name + "</option>");
        }
    });
}

function agent_refresh(){
    $('#netTbl').DataTable().ajax.reload();
    restRequest('POST', {"index":"core_group"}, reloadGroupElements);
}

/** OPERATIONS **/

let atomic_interval = null;

function toggleOperationView(){
    if($('#togBtnOp').is(':checked')) {
        showHide('.queueOption,#opBtn','#operations');
    } else {
        showHide('#operations,#opBtn','.queueOption');
    }
}

function handleStartAction(){
    let name = document.getElementById("queueName").value;
    if(!name){alert('Please enter an operation name!'); return; }

    let queueDetails = {
        "index":"core_operation",
        "name":name,
        "group":document.getElementById("queueGroup").value,
        "adversary":document.getElementById("queueFlow").value,
        "cleanup":document.getElementById("queueCleanup").value,
        "stealth":document.getElementById("queueStealth").value,
        "jitter":document.getElementById("queueJitter").value
    };
    restRequest('PUT', queueDetails, handleStartActionCallback);
}

function handleStartActionCallback(data){
    $("#togBtnOp").prop("checked", false).change();
    restRequest('POST', {'index':'core_operation'}, reloadOperationsElements);
}

function reloadOperationsElements(data){
    let op_elem = $("#operations");
    $.each(data, function(index, op) {
        if(!op_elem.find('option[value="'+op.id+'"]').length > 0){
            op_elem.append('<option id="chosen-operation" value="' + op.id +'">' + op.name + ' - ' + op.start + '</option>');
        }
    });
    op_elem.prop('selectedIndex', op_elem.find('option').length-1).change();
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
    if(chain.status == 0) {
        div.removeClass('grey');
        div.addClass('green');
    } else if (chain.status == 1) {
        div.removeClass('grey');
        div.addClass('red');
    } else {
        div.addClass('grey');
    }
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
    $('#resultCollected').html(data[0].link.finish);
    $('#resultCmd').html('>> ' + atob(data[0].link.command));
    $('#resultView').html(atob(data[0].output));
}

$('#queueJitter').on('focusin focusout', function() {
        $('#jitterInfo').toggle();
    });

/** ADVERSARIES **/

function toggleAdversaryView(){
    if($('#togBtnAdv').is(':checked')) {
        showHide('#profile-name', '#profile-existing-name');
    } else {
        showHide('#profile-existing-name', '#profile-name');
    }
}

function loadAdversary() {
    restRequest('POST', {'index':'core_adversary', 'id': $('#profile-existing-name').val()}, loadAdversaryCallback);
}

function loadAdversaryCallback(data) {
    $('#profile-name').val(data[0]['name']);
    $('#profile-description').val(data[0]['description']);
    $('#profile-tests').empty();
    $.each(data[0]['phases'], function(phase, abilities) {
        abilities.forEach(function(a) {
            $('#profile-tests').append(buildAbility(a.ability_id, a.name, a.technique.tactic, a.test, a.parser, phase, a.platform));
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
    restRequest('PUT', {"name":name,"description":description,"phases":abilities,"index":"core_adversary"}, createAdversaryCallback);
}

function createAdversaryCallback(data){
    $("#togBtnAdv").prop("checked", false).change();
    alert(data);
    restRequest('POST', {'index':'core_adversary'}, reloadAdversaryElements);
}

function reloadAdversaryElements(data){
    let adv_elem = $("#profile-existing-name");
    $.each(data, function(index, adv) {
        if(!adv_elem.find('option[value="'+adv.id+'"]').length > 0){
            adv_elem.append('<option id="chosen-operation" value="' + adv.id +'">' + adv.name + '</option>');
            $("#queueFlow").append("<option id='qflow-" + JSON.stringify(adv) + "' value='" + adv.id + "'>" + adv.name + "</option>");
        }
    });
    adv_elem.prop('selectedIndex', adv_elem.find('option').length-1).change();
}

function addAbility(exploits){
    let phase = $('#profile-phase').find(":selected").val();
    if(phase == 0){
        alert('No phase chosen!');
        return
    }
    let ability = null;
    exploits.forEach(function(a) {
        if(a.ability_id == $('#testId').val()) {
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
    $('#adversary-profile').find('#profile-tests').append(buildAbility(ability.ability_id, ability.name, ability.technique.tactic, ability.test, ability.parser, phase, ability.platform));
    refreshColorCodes();
    filterByPhase();
}

function removeAbility(test_id){
    $('#profile-tests #'+test_id).remove();
    refreshColorCodes();
}

function buildAbility(testId, testName, tactic, encodedTest, parser, phase, platform){
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
    let image = $('<p style="font-size:11px"/>').text(testName + ' ('+platform+')');
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
    $('#nextResult').click(function() {
        $('#decisionResult').get(0).value++;
        findResults();
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
        .attr("ability_id",value['ability_id'])
        .data("tactic", tactic)
        .data("technique", value['technique'])
        .data("name", value['name'])
        .data("description", value['description'])
        .data("platform", value['platform'])
        .data("test",value['test'])
        .data("parser",value['parser'])
        .text(value['name'] +' ('+value['platform']+')'));
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
    $(parent).find('#ability-id').val($(chosen).attr('ability_id'));
    $(parent).find('#ability-name').val($(chosen).data('name'));
    $(parent).find('#ability-executor').val($(chosen).data('platform'));
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
        "ability_id": $(parent).find('#ability-id').val(),
        "name": $(parent).find('#ability-name').val(),
        "description": $(parent).find('#ability-description').val(),
        "platform": $(parent).find('#ability-executor').val(),
        "tactic": $(parent).find('#ability-tactic').val(),
        "technique": {
          "attack_id": $(parent).find('#ability-technique-id').val(),
          "name": $(parent).find('#ability-technique-name').val()
        },
        "test": btoa($(parent).find('#ability-command').val())
    };
    restRequest('PUT', postData, createAbilityCallback);
}

function createAbilityCallback(data){
    alert(data);
    restRequest('POST', {"index":"core_ability"}, reloadAbilityElements);
}

function reloadAbilityElements(data){
    $("ability-test").empty();
    $('#ability-tactic-filter').change(function(){
        populateTacticAbilities(data);
    });
    $('#attach-ability-btn').click(function () {
        addAbility(data);
	});
}

function buildRequirements(encodedTest){
    let matchedRequirements = atob(encodedTest).match(/#{([^}]+)}/g);
    if(matchedRequirements) {
        matchedRequirements = matchedRequirements.filter(function(e) { return e !== '#{server}' });
        matchedRequirements = matchedRequirements.filter(function(e) { return e !== '#{group}' });
        matchedRequirements = matchedRequirements.filter(function(e) { return e !== '#{files}' });
        matchedRequirements = [...new Set(matchedRequirements)];
        return matchedRequirements.map(function(val){
           return val.replace(/[#{}]/g, "");
        });
    }
    return [];
}