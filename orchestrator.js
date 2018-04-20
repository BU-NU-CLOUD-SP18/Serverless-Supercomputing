const startingMilliseconds = Date.now();

// Checks if the given resource is provided, otherwise prints the given
// error message indicating the process failed due to an error
// with the config file. Exits the process.
const checkConfigFile = function (resource, errMsg){
	if (!resource){
		console.log("Error with config file: " + errMsg);
		process.exit(1);
	}
};

// Verify the config file contains all needed resources
checkConfigFile(process.argv[2], "No file passed as argument");
const configFile = process.argv[2];
const custom = require(configFile);
checkConfigFile(custom.action, "Need to export a function named 'action' to be run on OpenWhisk.");
checkConfigFile(custom.reduce, "Need to export a function named 'reduce' to combine results.");
checkConfigFile(custom.configs, "Need to export a dictionary named 'configs' with requred configurations.");
checkConfigFile(custom.configs['numActions'], "Configs dictionary must contain 'numActions' parameter.");
checkConfigFile(custom.configs['actionName'], "Configs dictionary must contain 'actionName' parameter.");
checkConfigFile(custom.configs['namespace'], "Configs dictionary must contain 'namespace' parameter.");

const request = require('request');
const execSync = require('child_process').execSync;

const apiCommandOutput = execSync('wsk property get --apihost').toString();
// Command returns in form 'wsk api host [APIHOST]' so we split string to get host
const APIHOST = apiCommandOutput.split(/\s+/)[3]; 

const authCommandOutput = execSync('wsk property get --auth').toString();
// Command returns in form 'wisk auth [AUTH]' so we split string to get auth
const AUTH = authCommandOutput.split(/\s+/)[2];
const split_auth = AUTH.split(':');
const USER = split_auth[0];
const PWD = split_auth[1];

const NUM_ACTIONS = custom.configs['numActions']
var responsesReceived = 0;

// Maps activation id to the action's number (0 -> NUM_ACTIONS - 1). Used
// to regenerate the correct parameters when triggering a new action 
// if an old action failed
var activationIdToActionNumMap = {};

// Ignore self signed cert
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// Generates url for OpenWhisk API. Url always begins with
// https://${AUTH}@${APIHOST}/api/v1/namespaces/${custom.configs['namespace']}/
// and the passed in urlEnding is appended to the end
const generateUrl = function(urlEnding){
 return `https://${AUTH}@${APIHOST}/api/v1/namespaces/${custom.configs['namespace']}/${urlEnding}`;
};

// Promise which makes an HTTP PUT request to register the action on OpenWhisk
const registerActionPromise = new Promise((resolve, reject) => {
	const headers = {
    	'Content-Type': 'application/json'
	};

	const dataString = JSON.stringify({
		"namespace": custom.configs['namespace'],
		"name": custom.configs['actionName'],
		"exec": {
			"kind": "nodejs:6",
			"code": custom.action.toString()
		},
		"limits": custom.configs['actionLimits']
	});

	const options = {
	    url: generateUrl(`actions/${custom.configs['actionName']}?overwrite=true`),
	    method: 'PUT',
	    headers: headers,
	    body: dataString
	};

	function callback(error, response, body) {
	    if (!error && response.statusCode == 200) {
	        console.log(body);
	        console.log("Action registered");
	        resolve(body);
	    } else {
	    	console.log(error);
			console.log(response);
	    	reject(response);
	    }
	}

	console.log("Registering action on OpenWhisk");
	request(options, callback);
});

// Function which generates a promise. That promise will make an HTTP post request 
// to OpenWhisk to trigger an action. Will only resolve once the action has completed
// on OpenWhisk and the value has been returned
const triggerActionPromise = function(actionNum){
	return new Promise((resolve, reject) => {
		const headers = {
	    	'Content-Type': 'application/json'
		};

		// Generate parameters for the action based on which action this is (0 -> NUM_ACTIONS - 1)
		const actionArgs = custom.argsForAction ? custom.argsForAction(actionNum) : {};
		const dataString = JSON.stringify(actionArgs);

		const options = {
		    url: generateUrl(`actions/${custom.configs['actionName']}`),
		    method: 'POST',
		    headers: headers,
		    body: dataString
		};

		function callback(error, response, body) {
		    if (!error && response.statusCode == 202) {
		    	body = JSON.parse(body);
		    	const activationId = body.activationId;
		    	activationIdToActionNumMap[activationId] = actionNum;

		    	// Generate promise to get the result of the action with given activationId
		    	getResultPromise(activationId).then(resolve).catch(reject);
		    } else {
				reject(response);
		    }
		}

		request(options, callback);
	});
};

// Generates a promise which will query the OpenWhisk server to get the result of 
// of the action with the given activationId. If the action has not finished, 
// wait 5 seconds, then query OpenWhisk again. If the action failed, trigger a new
// action to replace the failed one
const getResultPromise = function(activationId){
	return new Promise((resolve, reject) => {

		var headers = {
	    	'Content-Type': 'application/json'
		};

		var options = {
		    url: generateUrl(`activations/${activationId}`),
		    method: 'GET',
		    headers: headers
		};

		function callback(error, response, body) {
		    if (!error && response.statusCode == 200) {
		    	body = JSON.parse(body);
		    	var resp = body.response;
		    	if (resp.status == 'success'){
		    		responsesReceived++;
		    		console.log(responsesReceived + " out of " + NUM_ACTIONS + " actions have finished");
		    		resolve(resp.result);
		    	} else if (resp.status == 'whisk internal error') {
		    		// OpenWhisk internal error, try again, let OpenWhisk try different container
		    		console.log('Action ' + activationId + ' failed, trying again');
		    		console.log(body);
		    		triggerActionPromise(activationIdToActionNumMap[activationId]).then(resolve).catch(reject);
		    	} else {
		    		reject(response);
		    	}
		    } else if (!error && response.statusCode == 404) {
		    	setTimeout(() => {
		    		// Action hasn't finised yet, check again in 5 seconds
			    	getResultPromise(activationId).then(resolve).catch(reject);
		    	}, 5000);
		    } else {
		    	reject(response);
		    }
		}

		request(options, callback);
	});
};

// Creates an array of NUM_ACTIONS promises. Returns a promise
// which only resolves once all of the triggered actions have 
// finished
const triggerActionPromises = function(){
	const arr = [];
	for (var i = 0; i < NUM_ACTIONS; i++){
		arr.push(triggerActionPromise(i));
	}
	console.log('Triggering actions');
	return new Promise((resolve, reject) => {
		Promise.all(arr).then(resolve).catch(reject);
	});
};

// Register action, then trigger actions, then pass the responses to the 
// provided user reduce function
registerActionPromise.then(triggerActionPromises).then((response) => {
	custom.reduce(response);
	console.log("Finished in " + ((Date.now() - startingMilliseconds) / 1000) + " seconds");
}).catch((err) => {
	console.log(err);
	console.log('Operation failed');
	process.exit(1);
});
