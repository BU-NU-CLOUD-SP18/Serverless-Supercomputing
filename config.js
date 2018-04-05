const NUM_ACTIONS = 5000;
const TOTAL_POINTS = 100000;
const POINTS_PER_ACTION = TOTAL_POINTS / NUM_ACTIONS;

var configs = {
	"namespace": "_", 		// Namespace to be used by OpenWhisk on OpenShift
	"actionName": "testPoints", 	// Name to give the OpenWhisk action
	"numActions": NUM_ACTIONS,	// Number of actions to trigger
	"actionLimits" : {		// Limits for each instance of an action
		"timeout": 60000,	// Action timeout after (milliseconds, default 60000)
		"memory": 128,		// Max memory for each action container (gb, default 256)
		"logs": 10		// Max memory for each action log (gb, default 10)
	}
};

function main(params) { 
	var inCircle = 0;
	var pointsPerAction = parseInt(params['pointsPerAction'])
	for(var i = 0; i < pointsPerAction; i++){
		randX = (Math.random() * 2) - 1;
		randY = (Math.random() * 2) - 1;
		distFromCenter = Math.sqrt(randX * randX + randY * randY);
		if (distFromCenter <= 1){
			inCircle = inCircle + 1;
		}
	}
	return {inCircle: inCircle};
};

function argsForAction(actionNum){
	args = {pointsPerAction: POINTS_PER_ACTION};
	return args;
}

function computePi(result){
	if (result){
		var totalInCircle = 0;
		for (var i = 0; i < result.length; i++){
			var actionResult = result[i];
			console.log("Action " + (i + 1) + " finished with " + JSON.stringify(actionResult));
			totalInCircle += actionResult['inCircle'];
		}
		console.log(totalInCircle + " out of " + TOTAL_POINTS + " were in the circle");
		console.log("Computed value of Pi: " + 4 * (totalInCircle / TOTAL_POINTS));
	} else {
		console.log('No results returned from OpenWhisk');
	}
};

exports.configs = configs;				// Configuration values for the action on OpenWhisk
exports.action = main;					// Function to be registered as action on OpenWhisk
exports.argsForAction = argsForAction;			// Function to generate agrs to be passed to action
exports.reduce = computePi;				// Function to combine results from all competed actions
