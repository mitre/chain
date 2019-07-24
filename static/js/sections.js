/** GROUPS **/

let agent_interval_time = 30000;
let agent_interval = null;

$(document).ready(function () {
    let table = $('#netTbl');
    table.DataTable({
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
        rowId: 'paw',
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
                    $(td).addClass('agent-groups');
                },
                render: function(data,type,row,meta){
                    let groups = [];
                    data['groups'].forEach(function(e){
                        let group = "<div class='tag' id='" + e['map_id'] + "'>" + e['name'] + "</div>";
                        groups.push(group);
                    });
                    return "<div class='agent-groups'  style='display: inline-block;' >" + groups.join("") + "</div>";
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
            },
            {
                targets: -1,
                data: null,
                fnCreatedCell: function(td, cellData, rowData, row, col){
                    $(td).addClass('red-x');
                    $(td).addClass('delete-agent');
                    $(td).attr('id', rowData['id']);
                },
                defaultContent: "X"
            }
        ],
        select: {
			style: 'multi'
		},
        order: [[1, 'asc']],
        errMode: 'throw'
    });
    table.on('click', 'td.delete-agent', function (e) {
        restRequest('DELETE', {"index": "core_agent", "id": $(this).attr('id')}, refreshGroupCallback);
    } );
    table.on('click', '.tag', function (e) {
        restRequest('DELETE', {"index": "core_group_map", "id": $(this).attr('id')}, refreshGroupCallback);
        $(this).remove();
    } );
    agent_interval = setInterval(agent_refresh, agent_interval_time);
});

function createGroup(){
    let paws = $.map($('#netTbl').DataTable().rows('.selected').data(), function (item) {return item['paw'];});
    if(paws.length == 0){ alert("You need to select some hosts!"); return;}
    let groupName = $("#groupNewName").val();
    restRequest('PUT', {"name":groupName,"paws":paws,"index":"core_group"}, refreshGroupCallback);
}

function refreshGroupCallback(data){
    $('#netTbl').DataTable().rows().deselect();
    agent_refresh();
}

function agent_refresh(){
    $('#netTbl').DataTable().ajax.reload();
    restRequest('POST', {"index":"core_group"}, reloadGroupElements);
}

function reloadGroupElements(data){
    removeGroupElements(data, "qgroup-");
    addGroupElements(data, "#queueGroup", "qgroup-");
    removeGroupElements(data, "ggroup-");
    addGroupElements(data, "#groupName", "ggroup-");
}

function addGroupElements(data, groupElementId, optionIdPrefix) {
    let group_elem = $(groupElementId);
    $.each(data, function(index, gp) {
        if(!group_elem.find('option[value="'+gp.id+'"]').length > 0){
            if (gp.deactivated === 0){
                group_elem.append("<option id='" + optionIdPrefix + gp.name + "' value='" + gp.id + "'>" + gp.name + "</option>");
            }
        }
    });
}

function removeGroupElements(data, optionIdPrefix) {
     let options = document.querySelectorAll('*[id^="' + optionIdPrefix + '"]');
     Array.prototype.forEach.call(options, function (node) {
         let remove = true;
         data.forEach(function (item, index){
             if (node.innerText === item['name']){
                 remove = false;
             }
         });
         if(remove){
            node.parentNode.removeChild(node);
        }
     });
}

function toggleGroupView(){
    $('#createGroupSection').toggle();
    $('#deleteGroupSection').toggle();
}

function deleteGroup(){
    restRequest('DELETE', {"index": "core_group",
        "id": document.getElementById("groupName").value}, refreshGroupCallback);
    $(".groupDefault").prop('selected', true);
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
        "adversary":document.getElementById("queueFlow").value,
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
    $("#dash-group").html(operation.host_group.name);
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

$('#queueJitter').on({
    'mouseenter':function(){$('#jitterInfo').fadeIn();},
    'mouseleave':function(){$('#jitterInfo').fadeOut();}
});

/** ADVERSARIES **/

function loadAdversary() {
    restRequest('POST', {'index':'core_adversary', 'id': $('#profile-existing-name').val()}, loadAdversaryCallback);
}

function loadAdversaryCallback(data) {
    $('#profile-goal').html(data[0]['name'] + ' wants to ...');
    $('#profile-description').html(data[0]['description']);
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

        let phaseHeader = $('<h4 class="phase-headers">Phase ' + phase +'<hr></h4>');
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

    let unlocked = [];
    ability.parser.forEach(function (item) {
        unlocked.push(item['property']);
    });

    if($('#advView').val() === "1") {
        template.find('#name').html(ability.technique.tactic);
        template.find('#description1').html(ability.technique.attack_id + ':'+ ability.technique.name);
    } else if ($('#advView').val() === "2") {
        template.find('#name').html(ability.name);
        template.find('#description1').html('<b>Requires: </b>'+ requirements);
        template.find('#description2').html('<b>Unlocks: </b>'+ unlocked);
    } else {
        template.find('#name').html(ability.name);
        template.find('#description1').html(ability.description);
    }
    ability.platform.forEach(function(p) {
        let icon = null;
        if(p === 'windows') {
            icon = $('<img src="/chain/img/windows.png"/>');
        } else if (p === 'linux') {
            icon = $('<img src="/chain/img/linux.png"/>');
        } else {
            icon = $('<center><img src="/chain/img/macos.png"/>');
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
            let difference = $(this).data('requirements').filter(x => !parser.includes(x));
            $(this).data("facts", parser);
            if (difference.length) {
                $(this).css('border', '4px solid red');
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
