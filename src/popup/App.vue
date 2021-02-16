<style scoped>

#popup {
    width: 200px;
    margin-top: 30px;
    margin-bottom: 30px;
    text-align: center;
}

#message {
    margin-top: 10px;
}

#error {
    color: rgb(165, 7, 7);
    margin-top: 10px;
}

.button-wrapper {
    margin-top: 5px;
    margin-bottom: 5px;
}

label {
    font-weight: bold;
}

</style>

<template>
    <div id="popup" v-if="componentLoaded">
        <div id="setup" v-if="mode === MODES.AUTHORIZE">
            <a href="https://github.com/settings/tokens/new" target="_blank">Create Token on GitHub</a>
            <br>
            <p>Make sure to give 'repo' permission when creating the token.</p>
            <label for="token">GitHub Personal Access Token</label>
            <input v-model="token" type="text" name="token" :disabled="loading"><br><br>
            <div class="button-wrapper">
                <button v-on:click="setToken">Submit</button>
            </div>
            <div class="button-wrapper" v-if="hasToken">
                <button v-on:click="changeMode(MODES.SETUP)">Skip</button>
            </div>
        </div>
        <div id="setup" v-if="mode === MODES.SETUP">
            <label for="user">User</label>
            <input v-model="username" type="text" id="user" name="user" disabled><br><br>
            <label for="repo">Repo Name</label>
            <input v-model="repo" type="text" id="repo" name="repo" :disabled="loading"><br><br>
            <div class="button-wrapper">
                <button v-on:click="create">Create</button>
            </div>
            <div class="button-wrapper">
                <button v-on:click="link">Link Existing</button>
            </div>
        </div>
        <div id="sync" v-if="mode === MODES.SYNC">
            <h3>Repo: <a :href="getRepoLink()" target="_blank">{{ username }}/{{ repo }}</a></h3>
            <p><a :href="getActionsLink()" target="_blank">Actions</a></p>
            <div class="button-wrapper">
                <button v-on:click="sync">Sync</button>
            </div>
            <div class="button-wrapper">
                <button v-on:click="changeMode(MODES.AUTHORIZE)">Reset Config</button>
            </div>
        </div>
        <div id="message" v-if="message">
            {{ message }}
        </div>
        <div id="error" v-if="error">
            <strong>Error:</strong> {{ error }}
        </div>
    </div>
</template>

<script>
const MODES = {
    SETUP: 'setup',
    AUTHORIZE: 'authorize',
    SYNC: 'sync',
};

export default {
  data() {
    return {
        componentLoaded: false,
        MODES: MODES,
        mode: MODES.AUTHORIZE,
        token: '',
        hasToken: false,
        username: '',
        // Default name for the repo if it hasn't been created yet.
        repo: 'leetcode-solutions',
        error: '',
        loading: false,
        message: '',
    }
  },
  created: function () {
    chrome.storage.sync.get(['username', 'repo', 'accessToken'], (result) => {
        if (result.username) {
            this.username = result.username;
        }
        if (result.accessToken) {
            // Note: we purposely don't store the actual access token on the front-end component
            // since the background process can fetch it from storage.
            this.mode = MODES.SETUP;
            this.hasToken = true;
        }
        if (result.repo) {
            this.repo = result.repo;
            this.mode = MODES.SYNC;
        }
        this.componentLoaded = true;
    });
  },
  methods: {
    getRepoLink: function() {
        return 'https://github.com/' + this.username + '/' + this.repo;
    },
    getActionsLink: function() {
        return this.getRepoLink() + '/actions';
    },
    changeMode: function(mode) {
        this.error = '';
        this.message = '';
        this.loading = false;
        this.mode = mode;
    },
    sendMessage: function(data, callback) {
        this.error = '';
        this.message = '';
        this.loading = true;
        chrome.runtime.sendMessage(data, (response) => {
            this.loading = false;
            if (response.error) {
                this.error = response.error;
                return;
            }

            // Action was successful, perform actual callback.
            callback(response);

            // Clear error message so it doesn't show up on next screen.
            this.error = '';
        });
    },
    setToken: function (event) {
        this.sendMessage({action: 'authorize', token: this.token}, (response) => {
            this.username = response.username;
            this.mode = MODES.SETUP;
        });
    },
    create: function (event) {
        this.sendMessage({action: 'create', repo: this.repo}, (response) => {
            this.mode = MODES.SYNC;
        });
    },
    link: function (event) {
        this.sendMessage({action: 'link', repo: this.repo}, (response) => {
            this.mode = MODES.SYNC;
        });
    },
    sync: function (event) {
        this.sendMessage({action: 'sync'}, (response) => {
            this.message = 'Workflow action triggered, check status in Actions link';
        });
    },
  }
}

</script>
