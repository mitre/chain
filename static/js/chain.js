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
       success: function(data) { callback(data); },
       error: function (xhr, ajaxOptions, thrownError) { console.log(thrownError); }
    });
}

function showHide(show, hide) {
    $(show).each(function(){$(this).prop('disabled', false).css('opacity', 1.0)});
    $(hide).each(function(){$(this).prop('disabled', true).css('opacity', 0.5)});
}

function alertCallback(data) {
    alert("Success (you may need to refresh)!");
}

function deleteObject(table, identifier) {
    restRequest('DELETE', {"index": table, "id": identifier}, alertCallback);
}