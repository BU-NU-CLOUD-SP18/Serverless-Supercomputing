## Overview

Serverless/FaaS computing really started taking off with the launch of AWS Lamba.  However, the downside of a vendor-specific solution like AWS Lambda is vendor lock-in - you can no longer easily move your application to another provider and you have no control over your cost. Recently Red Hat and other companies have made a bet on Apache OpenWhisk, an Open Source solution for serverless computing that will run across all cloud and on-premise environments, and which as an Open Source solution can be implemented by multiple vendors or by users themselves.

This project aims to create an orchestration script that can leverage OpenWhisk to create an on demand super computer. It does this by registering a user-provided function as an action on OpenWhisk, then invoking the action hundreds of times. Each invocation creates a container on the OpenWhisk cluster, which the action code is injected into for execution. After all actions have completed, the results are passed into another user-provided function to be processed.

In addition to the orchestrator, this repo includes reports detailing the performance and resource usage of the 'supercomputer'.

## Steps to run orchestrator.js
### Prerequisite
* Docker should be installed
* OpenShift cli for oc commands
* OpenWhisk cli setup and wsk binaries path set in $PATH
* If running on a VM, Node.js should be installed on the machine

### Commands
```
 sudo systemctl start docker
 sudo ip link set docker0 promisc on
 sudo systemctl restart docker
 sudo oc cluster up
 sudo oc new-project openwhisk
 sudo oc process -f ./template.yml |sudo  oc create -f -

 sudo oc logs -f $(sudo oc get pods | grep controller | awk '{print $1}') | grep "invoker status changed"
 (wait till invoker status changed is healthy)

 AUTH_SECRET=$(sudo oc get secret whisk.auth -o yaml | grep "system:" | awk '{print $2}' | base64 --decode) &&
 /home/fedora/binaries/wsk property set --auth $AUTH_SECRET --apihost $(sudo oc get route/openwhisk --template={{.spec.host}})

 node orchestrator.js
```
 #### Monitor:
 ```
 sudo oc get pods
 sudo oc get all
 use the watch command for convenience
 ```
 #### Cleanup:
 ```
 sudo oc process -f template.yml | sudo oc delete -f -
 sudo oc cluster down
 ```

## Steps to run OpenWhisk on OpenShift on Mass Open Cloud (MOC):
### Through Web Console:
 * Login to MOC
 * Create a project
 * Download/Copy the template file at [https://git.io/openwhisk-template](https://git.io/openwhisk-template)
 * Add to project -> Add the template from previous step
 * Alter any parameters as you may need in the template wizard
 * Copy OpenWhisk authentication
 * Start the deployments
 

### Through command line:
### Prerequisite
 * OpenShift cli for oc commands
 * OpenWhisk cli setup and wsk binary

### Steps
  Login to the MOC:
  ```
  oc login https://openshift.massopen.cloud <token>
  ```
  Create a new project by running:
  ```
  oc new-project <projectname>
  ```
  Deploy OpenWhisk in your OpenShift project using the latest ephemeral template:
  ```
  oc process -f https://git.io/openwhisk-template | oc create -f -
  ```

## Performance and Scalibilty Analysis
To take a deep dive in Performance and Scalibilty Analysis and what we learnt in each iteration refer "Performance and Scalibilty Analysis I.pdf" and "Performance and Scalibilty Analysis II.pdf" in performance-cpu-analysis

## Project Proposal

### 1.   Vision and Goals Of The Project:

The goal of this project is to build an on demand "supercomputer" out of OpenWhisk on OpenShift on OpenStack in the MOC.  Namely, we will take a highly parallelizable function, the computation of pi, and rather than spin up virtual machines or containers to solve the problem, we can instead use OpenWhisk/FaaS to have an on demand supercomputer.  The goal would be to give a small portion of the work to each function, and spin up 1000s of workers to accomplish the job as quickly as possible. We will build a script to act as an orchestrator and coordinate these workers. 


### 2. Users/Personas Of The Project:

There is not a particular end user who will be using this. Rather, this will serve as a proof of concept that OpenWhisk and OpenShift can be used to solve a parallel algorithm. By providing performance metrics, we will be able to show whether or not using FaaS on OpenStack is a viable and cost effective approach for develoment. If successful, an approach like the one we are taking may be used in the future by individual/institution looking for a solution of large scale distributed algorithm as fast and cheaply as possible.




### 3.   Scope and Features Of The Project:
  * An orchestrator that is capable of distributing a parallelizable function on OpenWhisk on OpenShift environment at low cost and as fast as possible
  
  * The orchestrator should be extendable to create an on demand supercomputer for parallelizable tasks on OpenWhisk on OpenShift in the MoC.
  
  * Ability to move to different vendors
    

### 4. Solution Concept

##### Global Architectural Structure Of the Project:
![](https://github.com/BU-NU-CLOUD-SP18/Serverless-Supercomputing/blob/master/images/SystemArchitecture.png)

##### The orchestrator (blue in the diagram above) will be involved in the following steps:
1. The system will divide a highly parallelizable algorithm (tbd) into subparts that can be run concurrently. Each unique subpart will be registered as an action on OpenWhisk.
2. The system will issue POST requests to OpenWhisk to trigger the actions with specified parameters.
3. For each action that is invoked, OpenWhisk will spawn a Docker container, and then the action code gets injected and executed using the parameters passed to it. OpenWhisk will respond the the POST requests with a unique process id for the action that was triggered by each specific request. 
4. When the action is finished executing in the Docker container, the container will be torn down. The result of the action will be stored in the DB on OpenWhisk under the unique process id for that action.
5. The system will issue another set of requests to OpenWhisk to get the results of the actions that were triggered. Each request will contain the process id of the action whose result is desired.
6. Using all results from the parallelized actions, the system will construct the result for the initial algorithm that was being run.

### 5. Acceptance criteria

- The system must be able to parallelize an algorithm to compute pi and run on OpenWhisk on OpenShift
- We must provide performance tests to validate the improved performance at scale
- The system must be deployable on the MOC
- We must provide performance tests for the sytem running on the MOC
- The algorithm should scale linearly as more machines are added
- The the algorithm should run in 30 seconds or less

### 6.  Release Planning:

##### Release 1 (Due 02/02/2018)
- Compiling the project proposal. 
- Reading the literature on the technologies we are going to use like OpenShift, OpenWhisk, Parallel Computing and Containerisation.

##### Release 2 (Due 02/16/2018)
- Able to finish the installation on everyone's machine. 
- Stand up OpenWhisk on OpenShift locally to develop an algorithm.
- Being able to run a hello world program in the dev environment.
- Researching efficient ways of implementing the algorithm whic is to evaluate the value of pi.

###### Deliverables
- Hello world program running on OpenWhisk



##### Release 3 (Due 03/2/2018)
- Write the pseudo code of the algorithm
- Identify the parts of algorithm that can be parallelized
- Build and Parallelize the algorithm to run on OpenWhisk on OpenShift in JavaScript.


###### Deliverables
- Parallelized implementation of the algorithm in JavaScript.


##### Release 4 (Due 03/16/2018)
- Write the orchestration framework

###### Deliverables
- orchestration framework

##### Release 5 (Due 03/30/2018)
- Run and test the algorithm on local OpenShift
- Analyse if the computation time decreases linearly and relative to the number of additional pods added
- Prove that the algorithm should scale linearly

###### Deliverables
- Test the algorithm as scale and provide performance data of the results

##### Release 6 (Due 04/13/2018)
- Deploy OpenWhisk onto OpenShift on the MOC

###### Deliverables
- Performance report proving that computation time reduces relatively to the number of pods added
- Performance report indicating that the value of pi was calculated under 30 sec

##### Release 7 (Due 04/20/2018)
- Rigours system testing
- Fixing bugs
- POC handover

###### Deliverables
- Performance Report


## Challenges Faced
##### Getting OpenWhisk running locally
Initially, we had a great deal of difficulty getting OpenWhisk running on OpenShift locally. Because OpenWhisk is so young, there were only a few GitHub repos with instructions about how to get it set up locally, and most involved running the project on a Linux machine. Thus, when we encountered issues with our local setup, there weren't many resources to help us. Ultimately, we decided to create a 'local' environment within a Fedora VM on the MOC.

##### Getting OpenWhisk running on OpenShift on the MOC 
We encountered a resource issue when trying to deploy the OpenWhisk pods to OpenShift on the MOC. Working with our mentors, we were able to idenfitfy this issue, increase the resource limits and redeploy the project. 

##### General youngness of OpenWhisk
When deploying the OpenWhisk pods on OpenShift, the latest container images are pulled from the docker registry. OpenWhisk is constantly being worked on by the Open Source community and developers at Red Hat, so the images are changing frequently. As a result, there have been several times when our setup has stopped working because the images changed without our knowledge and broken the previous setup.
