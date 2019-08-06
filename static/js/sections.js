/** GROUPS **/

$(document).ready(function () {
    $('#netTbl').DataTable({})
});

function saveGroups(){
    let data = $('#netTbl').DataTable().rows().data();
    data.each(function (value, index) {
        let group = document.getElementById(value[0]).value;
        restRequest('PUT', {"index":"core_agent", "paw": value[0], "host_group": group});
    });
    location.reload(true);
}

/** FACTS **/

$(document).ready(function () {
    $('#factTbl').DataTable({
    })
});

/** OPERATIONS **/

let atomic_interval = null;

function toggleOperationView() {
    $('#viewOperation').toggle();
    $('#addOperation').toggle();

    if ($('#togBtnOp').is(':checked')) {
        showHide('.queueOption,#opBtn', '#operations');
    } else {
        showHide('#operations', '.queueOption,#opBtn');
    }
}

function handleStartAction(){
    let name = document.getElementById("queueName").value;
    if(!name){alert('Please enter an operation name'); return; }

    let jitter = document.getElementById("queueJitter").value || "4/8";
    try {
        let [jitterMin, jitterMax] = jitter.split("/");
        jitterMin = parseInt(jitterMin);
        jitterMax = parseInt(jitterMax);
        if(!jitterMin || !jitterMax){
            throw true;
        }
        if(jitterMin >= jitterMax){
            alert('Jitter MIN must be less than the jitter MAX.');
            return;
        }
    } catch (e) {
        alert('Jitter must be of the form "min/max" (e.x. 4/8)');
        return;
    }

    let queueDetails = {
        "index":"core_operation",
        "name":name,
        "group":document.getElementById("queueGroup").value,
        "adversary_id":document.getElementById("queueFlow").value,
        "planner":document.getElementById("queuePlanner").value,
        "cleanup":document.getElementById("queueCleanup").value,
        "stealth":document.getElementById("queueStealth").value,
        "jitter":jitter,
        "sources":[document.getElementById("queueSource").value]
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
            op_elem.append('<option id="' + op.id + '" class="operationOption" ' +
                'value="' + op.id +'" >' + op.name + ' - ' + op.start + '</option>');
        }
    });
    op_elem.prop('selectedIndex', op_elem.find('option').length-1).change();
}

function refresh() {
    let selectedOperationId = $('#operations option:selected').attr('value');
    let postData = selectedOperationId ? {'index':'core_operation','id': selectedOperationId} : null;
    restRequest('POST', postData, operationCallback, '/plugin/chain/full');
}

function deleteOperationCallback(){
    removeOperationElements();
    clearTimeline();
    restRequest('POST', {'index':'core_operation'}, reloadOperationsElements);
    $("#operationDefault").prop('selected', true);
}

function clearTimeline() {
    let selectedOperationId = $('#operations option:selected').attr('value');
    $('.event').each(function() {
        let opId = $(this).attr('operation');
        if(opId && opId !== selectedOperationId) {
            $(this).remove();
        }
    });
}

function deleteOperation() {
    let op_id = document.getElementById("operations").value;
    restRequest('DELETE', {"index": "core_operation", "id": op_id}, deleteOperationCallback);
}

function removeOperationElements() {
     let options = document.querySelectorAll('.operationOption');
     Array.prototype.forEach.call(options, function (node) {
         node.parentNode.removeChild(node);
     });
 }

function operationCallback(data){
    let operation = data[0];
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
    if(operation.host_group.length > 0) {
        $("#dash-group").html(operation.host_group[0].host_group);
    } else {
        $('#dash-group').html('---');
    }
    $("#dash-flow").html(operation.adversary.name);

    clearTimeline();
    for(let i=0;i<operation.chain.length;i++){
        if($("#op_id_" + operation.chain[i].id).length === 0) {
            let template = $("#link-template").clone();
            let ability = operation.abilities.filter(item => item.id === operation.chain[i].ability)[0];
            template.find('#link-description').html(operation.chain[i].abilityDescription);
            template.find('#link-technique').html(ability.technique['attack_id'] + '<span class="tooltiptext">' + ability.technique['name'] + '</span>');
            template.attr("id", "op_id_" + operation.chain[i].id);
            template.attr("operation", operation.chain[i].op_id);
            template.attr("data-date", operation.chain[i].decide.split('.')[0]);
            template.find('#time-tactic').html('<div style="font-size: 13px;font-weight:100">Host #'
                + operation.chain[i].host_id +'... '+operation.chain[i].abilityName +' <span' +
            ' style="font-size:18px;float:right" onclick="rollup('+operation.chain[i].id+')">&#x2913;</span><span' +
            ' style="font-size:14px;float:right" onclick="findResults('+operation.chain[i].id+')">&#9733;</span></div>');
            template.find('#time-action').html(atob(operation.chain[i].command));
            refreshUpdatableFields(operation.chain[i], template);

            template.insertBefore("#time-start");
            $(template.find("#inner-contents")).slideUp();
            template.show();
        } else {
            let existing = $("#op_id_"+operation.chain[i].id);
            refreshUpdatableFields(operation.chain[i], existing);
        }
    }
}

function refreshUpdatableFields(chain, div){
    if(chain.collect)
        div.find('#link-collect').html(chain.collect.split('.')[0]);
    if(chain.finish)
        div.find('#link-finish').html(chain.finish.split('.')[0]);
    if(chain.status === 0) {
        div.removeClass('grey');
        div.addClass('green');
    } else if (chain.status === 1) {
        div.removeClass('grey');
        div.addClass('red');
    } else {
        div.addClass('grey');
    }
}

function rollup(id) {
    let inner = $("#op_id_"+id).find("#inner-contents");
    if ($("#op_id_"+id).find("#inner-contents").is(":visible")) {
        $(inner).slideUp();
    } else {
        $(inner).slideDown();
    }
}

function findResults(link_id){
    document.getElementById('more-modal').style.display='block';
    restRequest('POST', {'index':'core_result','link_id':link_id}, loadResults);
}

function loadResults(data){
    let res = atob(data[0].output);
    $.each(data[0].link.facts, function(k, v) {
        let regex = new RegExp(v.value, "g");
        res = res.replace(regex, "<span class='highlight'>"+v.value+"</span>");
    });
    $('#resultCmd').html(atob(data[0].link.command));
    $('#resultView').html(res);
}

/** ADVERSARIES **/

function saveNewAdversary() {
    let name = $('#profile-goal').val();
    if(!name){alert('Please enter an adversary name!'); return; }
    let description = $('#profile-description').val();
    if(!description){alert('Please enter a description!'); return; }

    let abilities = [];
    $('#profile-tests li').each(function() {
        abilities.push({"id": $(this).attr('id'),"phase":$(this).data('phase')})
    });
    restRequest('PUT', {"name":name,"description":description,"phases":abilities,"index":"core_adversary", 'i': uuidv4()}, createAdversaryCallback);
    location.reload(true);
}

function createAdversaryCallback(data) {
    console.log(data);
}

function loadAdversary() {
    restRequest('POST', {'index':'core_adversary', 'id': $('#profile-existing-name').val()}, loadAdversaryCallback);
    validateFormState(($('#profile-existing-name').val()), '#advNewBtn');
}

function loadAdversaryCallback(data) {
    $('#profile-goal').val(data[0]['name']);
    $('#profile-description').val(data[0]['description']);

    $('.tempPhase').remove();
    $('.phase-headers').remove();
    $.each(data[0]['phases'], function(phase, abilities) {
        let template = $("#phase-template").clone();
        template.attr("id", "tempPhase" + phase);
        template.addClass("tempPhase");

        abilities = addPlatforms(abilities);
        abilities.forEach(function(a) {
            let abilityBox = buildAbility(a, phase);
            template.find('#profile-tests').append(abilityBox);
        });
        template.insertBefore('#dummy');
        template.show();

        let phaseHeader = $('<h4 class="phase-headers">Phase ' + phase +'&nbsp&nbsp&nbsp;<span onclick="showPhaseModal('+phase+')">&#10010;</span><hr></h4>');
        phaseHeader.insertBefore("#tempPhase" + phase);
        phaseHeader.show();
    });
    refreshColorCodes();
}

function addPlatforms(abilities) {
    let ab = [];
    abilities.forEach(function(a) {
        let exists = false;
        for(let i in ab){
            if(ab[i].ability_id === a.ability_id) {
                ab[i]['platform'].push(a.platform);
                exists = true;
                break;
            }
        }
        if(!exists) {
            a['platform'] = [a.platform];
            ab.push(a);
        }
    });
    return ab;
}

function buildAbility(ability, phase){
    let requirements = buildRequirements(ability.test);
    let template = $("#ability-template").clone();
    template.attr('id', ability.ability_id)
        .data('parser', ability.parser)
        .data('testId', ability.ability_id)
        .data('phase', phase)
        .data('requirements', requirements);

    template.find('#name').html(ability.name);
    template.find('#description').html(ability.description);
    template.find('#ability-attack').html(ability.technique.tactic + ' | '+ ability.technique.attack_id + ' | '+ ability.technique.name);

    if(requirements.length > 0) {
        template.find('#ability-metadata').append('<td><div id="ability-padlock"><div class="tooltip"><span class="tooltiptext">This ability has requirements</span>&#128274;</div></div></td>');
    }
    if(ability.cleanup) {
        template.find('#ability-metadata').append('<td><div id="ability-broom"><div class="tooltip"><span class="tooltiptext">This ability can clean itself up</span>&#128465;</div></div></td>');
    }
    if(ability.parser.length > 0) {
       template.find('#ability-metadata').append('<td><div id="ability-parser"><div class="tooltip"><span class="tooltiptext">This ability unlocks other abilities</span>&#128273;</div></div></td>');
    }
    if(ability.payload.length > 0) {
       template.find('#ability-metadata').append('<td><div id="ability-payload"><div class="tooltip"><span class="tooltiptext">This ability uses a payload</span>&#128176;</div></div></td>');
    }
    template.find('#ability-metadata').append('<td><div id="ability-remove"><div class="tooltip"><span class="tooltiptext">Remove this ability</span>&#x274C;</div></div></td>');
    template.find('#ability-remove').click(function() {
        removeAbility(ability.ability_id);
    });

    ability.platform.forEach(function(p) {
        let icon = null;
        if(p === 'windows') {
            icon = $('<div class="tooltip"><span class="tooltiptext">Works on Windows</span><img src="/chain/img/windows.png"/></div>');
        } else if (p === 'linux') {
            icon = $('<div class="tooltip"><span class="tooltiptext">Works on Linux</span><img src="/chain/img/linux.png"/></div>');
        } else {
            icon = $('<div class="tooltip"><span class="tooltiptext">Works on MacOS</span><img src="/chain/img/macos.png"/></div>');
        }
        icon.appendTo(template.find('#icon-row'));
    });
    template.show();
    return template;
}

function refreshColorCodes(){
    $('.ability-box').each(function() {
        if($(this).data('parser') != null) {
            let parser = [];
            $('.ability-box').each(function () {
                if ($(this).data('parser') != null) {
                    $(this).data('parser').forEach(function (item) {
                        parser.push(item['property']);
                    });
                }
            });
            if($('#advFactSource').val() != "") {
                let facts = $('#advFactSource').val();
                facts = facts.replace(/'/g, '"');
                JSON.parse(facts).forEach(function(f) {
                    parser.push(f);
                });
            }
            let difference = $(this).data('requirements').filter(x => !parser.includes(x));
            $(this).data("facts", parser);
            if (difference.length) {
                $(this).css('opacity', '0.4');
            } else {
                $(this).css('opacity', '1.0');
            }
        }
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

function removeAbility(ability_id){
    $('#'+ability_id).remove();
    refreshColorCodes();
}

function populateTechniques(exploits){
    exploits = addPlatforms(exploits);
    let parent = $('#phase-modal');
    $(parent).find('#ability-ability-filter').empty();
    $(parent).find('#ability-technique-filter').empty().append("<option disabled='disabled' selected>Choose a technique</option>");

    let tactic = $(parent).find('#ability-tactic-filter').find(":selected").data('tactic');
    let found = [];
    let showing = [];
    exploits.forEach(function(ability) {
        if(tactic == ability.technique.tactic && !found.includes(ability.technique.attack_id)) {
            found.push(ability.technique.attack_id);
            appendTechniqueToList(tactic, ability);
            appendAbilityToList(ability);
            showing += 1;
        }
    });
    $(parent).find('#ability-ability-filter').prepend("<option disabled='disabled' selected>"+showing.length+" abilities</option>");
}

function searchAbilities(exploits) {
    let parent = $('#phase-modal');
    $(parent).find('#ability-ability-filter').empty();
    $(parent).find('#ability-technique-filter').empty().append("<option disabled='disabled' selected>Choose a technique</option>");
    let showing = [];
    if($('#ability-search').val()) {
        exploits = addPlatforms(exploits);
        exploits.forEach(function(ability) {
            ability['test'] = atob(ability.test);
            ability['cleanup'] = atob(ability.cleanup);
            if(JSON.stringify(ability).toLowerCase().includes($('#ability-search').val().toLowerCase())) {
                ability['test'] = btoa(ability.test);
                ability['cleanup'] = btoa(ability.cleanup);
                appendAbilityToList(ability);
                showing += 1;
            }
        });
    }
    $(parent).find('#ability-ability-filter').prepend("<option disabled='disabled' selected>"+showing.length+" abilities</option>");
}

function populateAbilities(exploits){
    exploits = addPlatforms(exploits);
    let parent = $('#phase-modal');
    $(parent).find('#ability-ability-filter').empty();

    let showing = [];
    let attack_id = $(parent).find('#ability-technique-filter').find(":selected").data('technique');
    exploits.forEach(function(ability) {
        if(attack_id == ability.technique.attack_id) {
            appendAbilityToList(ability);
            showing += 1;
        }
    });
    $(parent).find('#ability-ability-filter').prepend("<option disabled='disabled' selected>"+showing.length+" abilities</option>");
}

function appendTechniqueToList(tactic, value) {
    $('#phase-modal').find('#ability-technique-filter').append($("<option></option>")
        .attr("value", value['technique']['attack_id'])
        .data("technique", value['technique']['attack_id'])
        .text(value['technique']['attack_id'] + ' | '+ value['technique']['name']));
}

function appendAbilityToList(value) {
    $('#phase-modal').find('#ability-ability-filter').append($("<option></option>")
        .attr("value", value['name'])
        .data("ability", value)
        .text(value['name']));
}

function showAbility() {
    let ability = $('#phase-modal').find('#ability-ability-filter').find(":selected").data('ability');
    restRequest('POST', {"ability_id": ability.ability_id}, showAbilityModal, endpoint='/stockpile/ability');
    validateFormState(($('#ability-ability-filter').val()), '#phaseBtn');
}

function showAbilityModal(data) {
    $('#phase-modal').data("ability", data);
    $('#ability-file').html(data);
}

function showPhaseModal(phase) {
    $('#phase-modal').data("phase", phase);
    document.getElementById("phase-modal").style.display="block";
}

function addToPhase() {
    let parent = $('#phase-modal');
    let phase = $(parent).data('phase');
    let ability = $('#phase-modal').find('#ability-ability-filter').find(":selected").data('ability');
    let abilityBox = buildAbility(ability, phase);
    $('#tempPhase' + phase).find('#profile-tests').append(abilityBox);
    refreshColorCodes();
}

function checkGpsDeleteFormValid() {
    validateFormState(($('#groupName').prop('selectedIndex') !== 0), '#deleteGroupBtn');
}

function checkGpsAddFormValid(){
    validateFormState(($('#groupNewName').val()), '#addGroupBtn');
}

function checkOpformValid(){
    validateFormState(($('#queueName').val()) && ($('#queueFlow').prop('selectedIndex') !== 0) && ($('#queueGroup').prop('selectedIndex') !== 0),
        '#opBtn');
}

function validateFormState(conditions, selector){
    (conditions) ?
        updateButtonState(selector, 'valid') :
        updateButtonState(selector, 'invalid');
}

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
