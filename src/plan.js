'use strict';

var L = require('leaflet');

module.exports = L.Routing.Plan.extend({
    reverseWaypoints: function(i, after) {
        var before = i - 1,
            wp = this._waypoints,
            s = wp[before];
            return L.Routing.Plan.prototype.spliceWaypoints.call(this, before, 2, [wp[i], s]);
    }
});