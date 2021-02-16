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
                console.log('Can\'t get cookie! Check the name!');
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
                    console.log('Can\'t get values! Check the names!');
                    reject(0);
                }
        })
    });
}

function syncSet(values) {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.set(values, () => resolve());
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

function createOctokit(accessToken) {
    return new Octokit({
        auth: accessToken,
        userAgent: 'LeetCode Sync Chrome v0.0',
    });
}

async function authorizeHandler(request, sendResponse) {
    const octokit = createOctokit(request.token);
    const user = await octokit.users.getAuthenticated();
    console.log(user);
    const username = user.data.login;
    await syncSet({
        username: username,
        accessToken: request.token,
    });
    sendResponse({username: username});
};

async function createHandler(request, sendResponse) {
    const result = await syncGet(['username', 'accessToken']);
    const owner = result.username;
    const repo = request.repo;
    const accessToken = result.accessToken;
    if (owner == null || repo == null || accessToken == null) {
        console.log('error getting values');
        return;
    }

    const octokit = createOctokit(accessToken);
    await octokit.repos.createUsingTemplate({
        template_owner: 'joshcai',
        template_repo: 'leetcode-sync-template',
        name: repo,
        private: true,
    });

    await syncSet({repo: repo});
    await updateSecrets(octokit);

    sendResponse({success: true});
};

async function syncHandler(request, sendResponse) {
    const result = await syncGet(['username', 'repo', 'accessToken']);
    const owner = result.username;
    const repo = result.repo;
    const accessToken = result.accessToken;
    if (owner == null || repo == null || accessToken == null) {
        console.log('error getting values');
        return;
    }
    const octokit = createOctokit(accessToken);
    const repoInfo = await octokit.repos.get({
        owner: owner,
        repo: repo,
      });
    const defaultBranch = repoInfo.data.default_branch;

    await updateSecrets(octokit);

    const resp = await octokit.actions.createWorkflowDispatch({
        owner,
        repo,
        workflow_id: 'sync_leetcode.yml',
        ref: defaultBranch,
    });
    console.log(resp)

    sendResponse({success: true});
};

async function linkHandler(request, sendResponse) {
    const result = await syncGet(['username', 'repo', 'accessToken']);
    const owner = result.username;
    const repo = request.repo;
    const accessToken = result.accessToken;
    if (owner == null || repo == null || accessToken == null) {
        console.log('error getting values');
        return;
    }
    const octokit = createOctokit(accessToken);
    // Get repo information to see if the repo exists.
    await octokit.repos.get({
        owner: owner,
        repo: repo,
    });

    await syncSet({repo: repo});
    await updateSecrets(octokit);

    sendResponse({success: true});
};


const MESSAGE_HANDLERS = {
    authorize: authorizeHandler,
    create: createHandler,
    sync: syncHandler,
    link: linkHandler,
};

chrome.runtime.onMessage.addListener(
    // We can't wrap the top function with async since it forces it to
    // return a `Promise`, but we want to return `true` to indicate that
    // `sendResponse` will happen asynchronously.
    function(request, sender, sendResponse) {
        (async () => {
            try {
                await MESSAGE_HANDLERS[request.action](request, sendResponse);
            } catch (error) {
                sendResponse({error: error.message});
            };
        })();
        return true;
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
        const octokit = createOctokit(accessToken);
        await updateSecrets(octokit);
        console.log('success!'); 
    }
  })