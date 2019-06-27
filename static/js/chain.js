function viewSection(identifier){
    let parent = $('#'+identifier);
    $(parent).insertAfter($('#atomic-blocks'));
    $(parent).css('display', 'block');
}

function clearWorkflow(){
    $('.section-profile').each(function(){ $(this).css('display', 'none'); });
}

function restRequest(type, data, callback) {
    $.ajax({
       url: '/plugin/chain/rest',
       type: type,
       contentType: 'application/json',
       data: JSON.stringify(data),
       success: function(data) { callback(data); },
       error: function (xhr, ajaxOptions, thrownError) { console.log(thrownError); }
    });
}

function enableDisable(enable, disable) {
    $(enable).each(function(){ $(this).prop('disabled', false).css('opacity', 1.0) });
    $(disable).each(function(){ $(this).prop('disabled', true).css('opacity', 0.5) });
}

function showHide(show, hide) {
    $(show).each(function(){$(this).prop('disabled', false).css('opacity', 1.0)});
    $(hide).each(function(){$(this).prop('disabled', true).css('opacity', 0.5)});
}
