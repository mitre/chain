function viewSection(identifier){
    let parent = $('#'+identifier);
    $(parent).insertBefore($('#atomic-blocks-end'));
    $(parent).css('display', 'block');
    window.location.hash='#'+identifier;
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
       success: function(data) { callback(data); },
       error: function (xhr, ajaxOptions, thrownError) { console.log(thrownError); }
    });
}

function showHide(show, hide) {
    $(show).each(function(){$(this).prop('disabled', false).css('opacity', 1.0)});
    $(hide).each(function(){$(this).prop('disabled', true).css('opacity', 0.5)});
}

function refreshCallback(data) {
    location.reload();
}

function deleteObject(table, identifier) {
    restRequest('DELETE', {"index": table, "id": identifier}, refreshCallback);
}

function updateButtonState(selector, state) {
    (state === 'valid') ?
        $(selector).attr('class','button-success atomic-button') :
        $(selector).attr('class','button-notready atomic-button');
}