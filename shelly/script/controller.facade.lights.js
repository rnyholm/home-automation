/**
 * Script for controlling facade lighting(output state) of a shelly device.
 * In short, this script will turn on output at sunset if time now is earlier than a specified time,
 * eg. if sunset and current time are earlier than 23:00, then turn on output.
 * Besides this, the script will also turn off output if it's on during a specified time.
 * The specified time mentioned will be the same for both turning on/off output and is set
 * as a constant.
 * This script will have no effect on turning on/off output manually.
 */

// constants
const timeOff = "23:15";     // time when output will be turned off, this is also act
                             // as the latest time the output is allowed to turn on
const outputId = 0;          // id of the output to control on the shelly device
const timerInterval = 5000;  // interval in milliseconds to run the timer(main) logic
const lat = XX.XXXXXX;       // Latitude according to your location
const lon = YY.YYYYYY;       // Longitude according to your location

// helpers
let sunset = null;
let sunsetLastFetched = null;

// helper functions
function formatTime() {
    function pad(number) {
        return number < 10 ? "0" + number : "" + number;
    }

    let now = new Date();
    return pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds());
}

function fetchSunsetIfNeeded() {
    let today = new Date().toISOString().slice(0, 10); // get date as YYYY-MM-DD

    // fetch sunset for latitude and longitude if not already fetched, or it hasn't been fetched today
    if (sunset === null || sunsetLastFetched !== today) {
        print("Fetching time of sunset as it's not fetched for today: " + today + ", sunset last fetched: " + sunsetLastFetched);
        Shelly.call("http.get",
            {url: "https://api.sunrisesunset.io/json?lat=" + lat + "&lng=" + lon + "&time_format=24", timeout: 10},
            function (response) {
                if (response && typeof response === "object" && "code" in response) {
                    if (response.code === 200) {
                        let obj = JSON.parse(response.body);
                        sunset = obj.results.sunset;
                        sunsetLastFetched = today;
                        print("Fetched time of sunset is: " + sunset);
                    } else {
                        print("Error: HTTP request failed with response code: " + response.code);
                    }
                } else {
                    print("Error: HTTP request failed, no valid response");
                }
            });
    }
}

// main logic
Timer.set(timerInterval, true, function () {
    // getting date now and fetch sunset
    let now = new Date();
    fetchSunsetIfNeeded();

    // unnecessary to proceed if sunset hasn't been fetched
    if (sunset !== null) {
        // convert "date now" to minutes
        let minutesNow = now.getHours() * 60 + now.getMinutes();

        // figure out set "time off" in minutes
        let timeOffParts = timeOff.split(":");
        let timeOffMinutes = parseInt(timeOffParts[0], 10) * 60 + parseInt(timeOffParts[1]);

        // lastly, figure out "sunset" in minutes
        let sunsetParts = sunset.split(":");
        let sunsetMinutes = parseInt(sunsetParts[0], 10) * 60 + parseInt(sunsetParts[1]);

        // turn output on if the sun has set now, and it's earlier than the "time off" limit
        if (minutesNow === sunsetMinutes && sunsetMinutes < timeOffMinutes) {
            Shelly.call("Switch.GetStatus", {id: outputId}, function (result, errorCode, errorMsg) {
                if (errorCode === 0) {
                    // output is off
                    if (!result.output) {
                        Shelly.call("Switch.set", {id: outputId, on: true});
                        print("Turning on facade lighting at: " + formatTime());
                    }
                }
            });
        }

        // turn output off
        if (minutesNow === timeOffMinutes) {
            Shelly.call("Switch.GetStatus", {id: outputId}, function (result, errorCode, errorMsg) {
                if (errorCode === 0) {
                    // output is on
                    if (result.output) {
                        Shelly.call("Switch.set", {id: outputId, on: false});
                        print("Turning off facade lighting at: " + formatTime());
                    }
                }
            });
        }
    }
});
