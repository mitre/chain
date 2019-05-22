function viewSection(identifier){
    let parent = $('#'+identifier);
    $(parent).insertAfter($('#atomic-blocks'));
    $(parent).css('display', 'block');
}

function clearWorkflow(){
    $('.section-profile').each(function(){ $(this).css('display', 'none'); });
}

function restRequest(type, data, callback, endpoint='/plugin/chain/rest') {
    $.ajax({
       url: endpoint,
       type: type,
       contentType: 'application/json',
       data: JSON.stringify(data),
       success:function(data) { callback(data); },
       error: function (xhr, ajaxOptions, thrownError) { console.log(thrownError); }
    });
}

function alertCallback(data) { alert(data);}

function showHide(show, hide) {
    $(show).each(function(){ $(this).prop('disabled', false).css('opacity', 1.0) });
    $(hide).each(function(){ $(this).prop('disabled', true).css('opacity', 0.5) });
}

function controlOp(mode){
    let op = $('#operations option:selected').attr('value');
    restRequest('POST', {'id': op, 'mode': mode}, getOpState, '/op/control');
}

function getOpState(data) {
    let op = $('#operations option:selected').attr('value');
    restRequest('POST', {'id': op, 'mode': 'state'}, opStateCallback, '/op/control');
}

function opStateCallback(data) {
    if (data['result'] === 'PAUSED'){
        $('#control-play').css('display','');
        $('#control-pause').css('display','none');
    }
    if (data['result'] === 'RUNNING') {
        $('#control-play').css('display','none');
        $('#control-pause').css('display','');
    }
    document.getElementById('control-state').innerHTML = data['result']
}