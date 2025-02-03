/**
 * Script to control a garage door with a shelly 1 with addon and a magnetic sensor.
 * Note! All timeouts and delays are in milliseconds.
 */

// constants
let inputId = 100;            // input id of the garage door sensor(digital in on addon)
let outputId = 0;             // output id of the relay(shelly 1) controlling the garage door
let forceCloseTimeout = 5000; // time to wait, between garage door closing and opening before forcing the door to close
let closeStopDelay = 1000;    // base delay to stop the garage door closing
let delayStep = 100;          // step to reduce the "close stop delay"
let controllerDelay = 2000;   // time to wait before sending open/close command to the garage door
let falseTriggerDelay = 700;  // time to wait before resetting doHandleEvent flag, this prevents false triggering

// helpers
let triggerCount = 0;
let doHandleEvent = true;
let timestamp = null;

Shelly.addEventHandler(function (event) {
    if (event.name === "input" && event.id === inputId) {
        if (doHandleEvent) {
            doHandleEvent = false;

            Timer.set(falseTriggerDelay, false, function () {
                doHandleEvent = true;
            });

            let state = event.info.state;
            let now = Shelly.getComponentStatus("sys").unixtime * 1000;

            if (!state) { // garage door closed
                print("Garagedoor closing");
                timestamp = now;

                if (triggerCount > 0) {
                    let adjustedDelay = Math.max(closeStopDelay - ((triggerCount - 1) * delayStep), 0);
                    Timer.set(adjustedDelay, false, function () {
                        Shelly.call("Switch.set", {id: outputId, on: true});
                        print("Garage door closing stopped after " + adjustedDelay + " ms.");
                    });
                }
            } else { // garage door opened
                print("Garagedoor opening");

                if (now - timestamp <= forceCloseTimeout) {
                    Timer.set(controllerDelay, false, function () {
                        Shelly.call("Switch.set", {id: outputId, on: true});
                        print("Garage door closing stopped after " + controllerDelay + " ms.");
                    });

                    Timer.set(controllerDelay * 2, false, function () {
                        Shelly.call("Switch.set", {id: outputId, on: true});
                        print("Garage door closing activated after " + controllerDelay * 2 + " ms.");
                    });

                    triggerCount++;
                } else {
                    triggerCount = 0;
                }
                timestamp = null;
            }
        }
    }
});
