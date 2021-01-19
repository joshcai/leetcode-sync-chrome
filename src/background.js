const { Octokit } = require("@octokit/rest");
const tweetsodium = require('tweetsodium');
const { Buffer } = require('buffer/');

// Wraps the chrome.cookies.get call so it can be used with `await`.
function getCookie(name){
    return new Promise((resolve, reject) => {
        chrome.cookies.get({
            url: 'https://leetcode.com', 
            name: name
        },
        function (cookie) {
            if (cookie) {
                resolve(cookie.value);
            }
            else {
                console.log('Can\'t get cookie! Check the name!')
                reject(0);
            }
        })
    });
}

function syncGet(names) {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get(names,
            function (result) {
                if (result) {
                    resolve(result);
                }
                else {
                    console.log('Can\'t get values! Check the names!')
                    reject(0);
                }
        })
    });
}

async function updateSecret(ctx, name, value) {
    return ctx.octokit.actions.createOrUpdateRepoSecret({
        owner: ctx.owner,
        repo: ctx.repo,
        secret_name: name,
        key_id: ctx.publicKeyInfo.data.key_id,
        encrypted_value: encryptSecret(value, ctx.publicKeyInfo.data.key),
    });
}

function encryptSecret(value, publicKey) {
    // Convert the message and key to Uint8Array's (Buffer implements that interface)
    const messageBytes = Buffer.from(value);
    const publicKeyBytes = Buffer.from(publicKey, 'base64');

    // Encrypt using LibSodium.
    const encryptedBytes = tweetsodium.seal(messageBytes, publicKeyBytes);

    // Base64 the encrypted secret
    return Buffer.from(encryptedBytes).toString('base64');
}

async function createProject() {
    const result = await syncGet(['username', 'repo', 'accessToken']);
    const owner = result.username;
    const repo = result.repo;
    const accessToken = result.accessToken;
    if (owner == null || repo == null || accessToken == null) {
        console.log('error getting values');
        return;
    }

    const octokit = new Octokit({
        auth: accessToken,
        userAgent: 'LeetCode Sync Chrome v0.0',
    });

    await octokit.repos.createUsingTemplate({
        template_owner: 'joshcai',
        template_repo: 'leetcode-sync-template',
        name: repo,
        private: true,
    });
    await updateSecrets(octokit);
}

chrome.runtime.onMessage.addListener(
    async function(request, sender, sendResponse) {
      if (request.action == 'create') {
        await createProject();
        sendResponse({});
      }
    }
);


async function updateSecrets(octokit) {
    const result = await syncGet(['username', 'repo', 'accessToken']);
    const owner = result.username;
    const repo = result.repo;
    const accessToken = result.accessToken;
    if (owner == null || repo == null || accessToken == null) {
        console.log(owner);
        console.log(repo);
        console.log(accessToken);
        console.log('error getting values');
        return;
    }
    const csrfToken = await getCookie('csrftoken');
    const leetcodeSession = await getCookie('LEETCODE_SESSION');

    const publicKeyInfo = await octokit.actions.getRepoPublicKey({
        owner: owner,
        repo: repo,
    });

    const context = {
        octokit,
        owner,
        repo,
        publicKeyInfo,
    }
    await updateSecret(context, 'LEETCODE_SESSION', leetcodeSession);
    await updateSecret(context, 'LEETCODE_CSRF_TOKEN', csrfToken);
    console.log('secrets updated');
}

chrome.runtime.onInstalled.addListener(function() {
    chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
      chrome.declarativeContent.onPageChanged.addRules([{
        conditions: [new chrome.declarativeContent.PageStateMatcher({
          pageUrl: {hostEquals: 'leetcode.com'},
        })
        ],
            actions: [new chrome.declarativeContent.ShowPageAction()]
      }]);
    });
  });

  chrome.tabs.onUpdated.addListener(async function (tabId, changeInfo, tab) {
    if (changeInfo.status == 'complete' && tab.url.includes('https://leetcode.com')) {
        const result = await syncGet(['username', 'repo', 'accessToken']);
        const owner = result.username;
        const repo = result.repo;
        const accessToken = result.accessToken;
        if (owner == null || repo == null || accessToken == null) {
            console.log(owner);
            console.log(repo);
            console.log(accessToken);
            console.log('error getting values');
            return;
        }

        const octokit = new Octokit({
            auth: accessToken,
            userAgent: 'LeetCode Sync Chrome v0.0',
        });
        await updateSecrets(octokit);
        console.log('success!'); 
    }
  })