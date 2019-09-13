function viewSection(identifier){
    let parent = $('#'+identifier);
    $(parent).insertBefore($('#atomic-blocks-end'));
    $(parent).css('display', 'block');
    window.location.hash='#'+identifier;
    redrawTables();
}

function clearWorkflow(){
    $('.section-profile').each(function(){ $(this).css('display', 'none'); });
}

function showHide(show, hide) {
    $(show).each(function(){$(this).prop('disabled', false).css('opacity', 1.0)});
    $(hide).each(function(){$(this).prop('disabled', true).css('opacity', 0.5)});
}
