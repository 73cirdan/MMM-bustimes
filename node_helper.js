'use strict';

/* MagicMirror²
 * Module: MMM-bustimes
 *
 * Adapted for Dutch system by Cirdan
 * Origin by Stefan Krause
 * MIT Licensed.
 */

const NodeHelper = require('node_helper');
const axios = require("axios").default;

/*
 * A wrapper for axios.get that throws an error if the status code is not 200.
 */
const getCheckedAsync = (url) =>
    
    axios.get(url)
    .catch(err => {
        throw new Error("Error fetching " + url + ": " + err);
    })
    .then(({status, data}) => {
        if (status != 200)
            throw new Error("Error fetching " + url + ": Status " + status);
        return data;
    });

module.exports = NodeHelper.create({
    /*
     * Fetch data for given codes (if any) from the API at a given endpoint.
     * Returns a promise with the parsed object.
     */
    fetchData: function(config, endpoint, code) {
        if (!code)
            return Promise.resolve({});

        let url = config.apiBase + "/" + endpoint + "/" + code;
        if (config.showOnlyDepartures)
            url += "/" + config.departuresOnlySuffix;

        return getCheckedAsync(url)
    },

    /*
     * Merge data from multiple TimingPoints and StopAreas into a single object,
     * with an entry per TimingPointCode. This effectively flattens the StopArea
     * data.
     */
    mergeData: function(timingPointData, stopAreaData) {
        const ret = {};
        Object.assign(ret, timingPointData);
        //console.log(timingPointData);
        for (const stopArea of Object.values(stopAreaData)) {
            Object.assign(ret, stopArea);
       	    //console.log(stopArea);
	}
        return ret;
    },

    /*
     * Process received data, with info per TimingPoint, into a list of departures per
     * stop, where TimingPoints are aggregated based on their name.
     */
    processData: function(data, destinationFilter, includeTownName, debug) {
        const departures = {};

        // Go over results for each requested tpc (e.g., bus stop). For each tpc
        // we get info about the stop itself, and all the passes (i.e.,
        // arrivals/departures of vehicles).
        for (const {Stop, Passes} of Object.values(data)) {
            const timingPointName = includeTownName ?
                Stop.TimingPointTown + ", " + Stop.TimingPointName :
                Stop.TimingPointName;

            const timingPointWheelChairAccessible = (Stop.TimingPointWheelChairAccessible == "ACCESSIBLE") ? 1 : 0;
            const timingPointVisualAccessible = (Stop.TimingPointVisualAccessible == "ACCESSIBLE") ? 1 : 0;

            if (!departures[timingPointName])
                departures[timingPointName] = [];

            for (const pass of Object.values(Passes)) {
                const destination = pass.DestinationName50 || "?";
                const operator = pass.OperatorCode || pass.DataOwnerCode || "?";

                if (destinationFilter.length > 0 &&
                    !destinationFilter.includes(pass.DestinationCode)) {
                    if (debug)
                        console.log(this.name + ": Skipped line " + pass.LinePublicNumber +
                            " with destination " + pass.DestinationCode + " (" + destination + ")");
                    continue;
                }

                const wheelchairAccessible = (pass.WheelChairAccessible == "ACCESSIBLE") ? 1 : 0;

                departures[timingPointName].push({
                    TargetDepartureTime: pass.TargetDepartureTime,
                    ExpectedDepartureTime: pass.ExpectedDepartureTime,
                    TransportType: pass.TransportType,
                    LinePublicNumber: pass.LinePublicNumber,
                    LineWheelChairAccessible: wheelchairAccessible,
                    TimingPointName: pass.TimingPointName,
                    TimingPointWheelChairAccessible: timingPointWheelChairAccessible,
                    TimingPointVisualAccessible: timingPointVisualAccessible,
                    Operator: operator,
                    LastUpdateTimeStamp: pass.LastUpdateTimeStamp,
                    Destination: destination,
                });
            }

            // If we filtered out all departures for this stop, remove stop
            // itself too.
            if (departures[timingPointName].length == 0)
                delete departures[timingPointName];
        }
	//console.log(departures);
        // Sort departures by time, per timingpoint.
        for (const departureList of Object.values(departures))
            departureList.sort(
                (obj1, obj2) => obj1["ExpectedDepartureTime"].localeCompare(
                    obj2["ExpectedDepartureTime"]));

	return departures;
    },

    /*
     * Requests data for TimingPoints and StopAreas, combining and parsing the
     * results, and sending it back to the module to display.
     */
    getData: function(moduleIdentifier, config) {
        const fetchTimingPoints = this.fetchData(config, config.timingPointEndpoint, config.timingPointCode);
        const fetchStopAreas = this.fetchData(config, config.stopAreaEndpoint, config.stopAreaCode);

        Promise.all([fetchTimingPoints, fetchStopAreas])
        .then(([timingPointData, stopAreaData]) =>
            this.mergeData(timingPointData, stopAreaData)
        )
        .then(data =>
            this.processData(data, config.destinations, config.showTownName, config.debug)
        )
        .then(data =>
            this.sendSocketNotification("DATA", {
                identifier: moduleIdentifier,
                data: data
            })
        )
        .catch(err => {
            console.log(this.name + ": " + err);
            this.sendSocketNotification("ERROR", {
                identifier: moduleIdentifier,
                error: err.message
            })
        });
    },

    socketNotificationReceived: function(notification, payload) {
	const axiosfix = payload.config.axiosfix;
        if (axiosfix && axiosfix!="") {
            axios.defaults.headers.common['User-Agent'] = axiosfix;
        } // issue 15

        if (notification === 'GETDATA')
            this.getData(payload.identifier, payload.config);
    }
});
