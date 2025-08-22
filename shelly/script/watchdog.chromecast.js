/**
 * Script for "pinging" an open endpoint of a chromecast with an http get request.
 * If the chromecast doesn't respond with http status 200 or responds with any error, the chromecast
 * will be restarted. The restart is done by toggling the output state on and off.
 * Note! All times are in milliseconds
 */

// constants
const chromecastIp = "192.168.10.101";                // ip address of chromecast
const port = 8008;                                    // port of chromecast
const endpoint = "/setup/eureka_info?options=detail"; // endpoint of chromecast
const watchdogInterval = 30000;                       // interval of the watchdog timer
const chromecastStartupDelay = 1500;                  // delay between shutdown and startup of chromecast
const outputId = 0;                                   // id of the output to control on the shelly device

// helper functions
function restartChromecast(id, delay) {
    print("Shutting down chromecast (" + chromecastIp + ")...");
    Shelly.call("Switch.Set", {id: id, on: false});

    Timer.set(delay, false, function () {
        print("Starting chromecast (" + chromecastIp + ")...")
        Shelly.call("Switch.Set", {id: id, on: true});
    });
}

// main logic
Timer.set(watchdogInterval, true, function () {
    const url = "http://" + chromecastIp + ":" + port + endpoint

    Shelly.call("http.get",
        {url: url},
        function (response, error_code, error_message) {
            if (error_code === 0 && response && response.code === 200) {
                print("Success: Chromecast (" + chromecastIp + ") is up and running!");
            } else {
                print("Error: Chromecast (" + chromecastIp + ") unreachable (" + error_message + "), restarting...");
                restartChromecast(outputId, chromecastStartupDelay);
            }
        }
    );
});
