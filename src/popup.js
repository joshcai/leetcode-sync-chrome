
function getValue(elementId) {
    return document.getElementById(elementId).value;
}

function setValue(elementId, value) {
    if (value == null) {
        return;
    }
    document.getElementById(elementId).value = value;
}

chrome.storage.sync.get(['username', 'repo', 'accessToken'], function(result) {
    setValue('username', result.username);
    setValue('repo', result.repo);
    setValue('accessToken', result.accessToken);
});

document.getElementById('submit').addEventListener('click', function() {
    console.log(getValue('username'));
    console.log(getValue('repo'));
    console.log(getValue('accessToken'));
    chrome.storage.sync.set({
        username: getValue('username'),
        repo: getValue('repo'),
        accessToken: getValue('accessToken'),
    }, function() {
        console.log('synced');
    })
 });

document.getElementById('create').addEventListener('click', function() {
    console.log(getValue('username'));
    console.log(getValue('repo'));
    console.log(getValue('accessToken'));
    chrome.runtime.sendMessage({action: 'create'}, function(response) {
        console.log('created successfully');
    });
 });