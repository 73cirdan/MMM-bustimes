'use strict';

/* Magic Mirror
 * Module: MMM-bustimes
 *
 * Adapted for Dutch system by Cirdan
 * Origin by Stefan Krause
 * MIT Licensed.
 */

const NodeHelper = require('node_helper');
var request = require('request');

module.exports = NodeHelper.create({
    /*
     * Requests new data from ovapi.nl, and forward response to the module.
     */
    getData: function(moduleIdentifier, config) {
        var self = this;
        var ovUrl = config.apiBase + "/" + config.tpcEndpoint + "/" + config.timingPointCode;

        request({
            url: ovUrl,
            method: 'GET',
        }, function(error, response, body) {
            if (!error && response.statusCode == 200) {
                self.sendSocketNotification("DATA", {
                    identifier: moduleIdentifier,
                    data: body
                });
            } else {
                var errorMsg = error ? error : "Status " + response.statusCode;
                console.log(self.name + ": Could not load timingpoint(s) on url " + ovUrl + ": " + errorMsg);
                self.sendSocketNotification("ERROR", {
                    identifier: moduleIdentifier,
                    error: errorMsg
                });
            }
        });
    },

    socketNotificationReceived: function(notification, payload) {
        if (notification === 'GETDATA')
            this.getData(payload.identifier, payload.config);
    }
});
