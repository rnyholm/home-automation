/**
 * Script to monitor open/close status of a garage door with a shelly 1 with addon and a magnetic sensor connected to digital in on the addon.
 * Script will send notifications through CallMeBot if the garage door has been open for too long.
 * Note! All delays/timeouts/intervals are in minutes if nothing else are stated.
 */

// constants
const inputId = 100;                         // input id of the garage door sensor(digital in on addon)
const notificationDelay = 10;                // time to wait before sending notification about open garage door
const repeatingNotificationInterval = 30;    // interval of repeating notification about open garage door
const watchDogInterval = 5000;               // note! this is in milliseconds! interval of the watchdog timer
const anguishedFaceSmiley = "%F0%9F%98%A7";  // url encoded emoji, used for notification
const screamingFaceSmiley = "%F0%9F%98%B1";  // url encoded emoji, used for notification
const callmebotApiKeys = ["xxxxxxxx", "yyyyyyyy"]; // api keys for CallMeBot, used for notification

// helpers
let timestampUnix = null;
let timestampUser = null;
let notificationSent = false;
let repeatingNotificationCount = 0;

function sendMessage(message) {
    for (let i = 0; i < callmebotApiKeys.length; i++) {
        let url = "https://api.callmebot.com/facebook/send.php?apikey=" + callmebotApiKeys[i] + "&text=";
        Shelly.call("http.get", {url: url + message.split(" ").join("+"), timeout: 10});
    }
};

Timer.set(watchDogInterval, true, function () {
    if (Shelly.getComponentStatus('input', inputId).state) { // garage door open
        if (timestampUnix === null) {
            timestampUnix = Shelly.getComponentStatus("sys").unixtime * 1000;
            timestampUser = Shelly.getComponentStatus("sys").time;
        }

        const now = Shelly.getComponentStatus("sys").unixtime * 1000;

        if ((now - timestampUnix >= notificationDelay * 60 * 1000) && !notificationSent) {
            notificationSent = true;
            sendMessage("Garageporten är fortfarande öppen" + anguishedFaceSmiley);
        }

        if (now - timestampUnix >= (repeatingNotificationInterval * (repeatingNotificationCount + 1) * 60 * 1000)) {
            let openTime = repeatingNotificationInterval * ++repeatingNotificationCount;
            let timeUnit;

            if (openTime % 60 === 0) {
                openTime /= 60;
                timeUnit = openTime === 1 ? "timme" : "timmar";
            } else {
                timeUnit = openTime === 1 ? "minut" : "minuter";
            }

            sendMessage("Garageporten har varit öppen sedan " + timestampUser + ", alltså " + openTime + " " + timeUnit + screamingFaceSmiley);
        }
    } else {
        timestampUnix = null;
        timestampUser = null;
        notificationSent = false;
        repeatingNotificationCount = 0;
    }
});
