/**
 * @overview  Depending on the thermostat capabilities reported, the dialog will allow to change the thermostat mode and/or change the setpoint temperature for the thermostat mode selected.
 * @author Martin Vach
 */

/**
 * Allows to set a certain setpoint to a thermostat (set temperature to maintain).
 * The command class can be applied to different kind of thermostats (heating, cooling, ...), hence it has various modes.
 * @class ThermostatController
 *
 */
appController.controller('ThermostatController', function($scope, $filter, $timeout,$interval,dataService,deviceService, cfg,_) {
    $scope.thermostats = {
        ids: [],
        all: [],
        interval: null,
        show: false,
        rangeSlider: [],
        mChangeMode: []
    };

    /**
     * Cancel interval on page destroy
     */
    $scope.$on('$destroy', function() {
        $interval.cancel($scope.thermostats.interval);
    });

    /**
     * Load zigbee data
     */
    $scope.loadZigbeeData = function() {
        dataService.loadZigbeeApiData().then(function(ZigbeeAPIData) {
            setData(ZigbeeAPIData);
            if(_.isEmpty($scope.thermostats.all)){
                $scope.alert = {message: $scope._t('device_404'), status: 'alert-warning', icon: 'fa-exclamation-circle'};
                return;
            }
            $scope.thermostats.show = true;
            $scope.refreshZigbeeData(ZigbeeAPIData);
        }, function(error) {
            alertify.alertError($scope._t('error_load_data'));
        });
    };
    $scope.loadZigbeeData();

    /**
     * Refresh zigbee data
     */
    $scope.refreshZigbeeData = function() {
        var refresh = function() {
            dataService.loadJoinedZigbeeData().then(function(response) {
                var update = false;
                angular.forEach(response.data.update, function(v, k) {
                    // Get node ID from response
                    var findId = k.split('.')[1];
                    // Check if node ID is in the available devices
                    if($scope.thermostats.ids.indexOf(findId) > -1){
                        update = true;
                        //console.log('Updating nodeId: ',findId);
                        return;
                    }
                });
                // Update found - updating available devices
                if(update){
                    setData(response.data.joined);
                }
            });
        };
        $scope.thermostats.interval = $interval(refresh, $scope.cfg.interval);
    };

    /**
     * Update thermostat mode
     * @param {string} url
     * @param {string} mode
     */
    $scope.updateThermostatMode = function(url,mode) {
        if (!mode) {
            return;
        }
        $scope.toggleRowSpinner(url);
        url = url + '.Set(' + mode + ')';
        updateThermostat(url);
    };

    /**
     * Update thermostat temperature on click
     * @param {string} url
     * @param {int}  index
     * @param {string}  type
     */
    $scope.updateThermostatTempClick = function(v, index, type) {
        var url = v.urlChangeTemperature;
        var step = v.range.step;
        $scope.toggleRowSpinner(url);
        var val = $scope.thermostats.rangeSlider[index];
        var min = parseInt( v.range.min,1);
        var max = parseInt(v.range.max, 1);
        var count = (type === '-' ? val - step: val + step);
        if (count < min) {
            count = min;
        }
        if (count > max) {
            count = max;
        }
        $scope.thermostats.rangeSlider[index] = count;
        url += '.Set('+v.curThermMode+',' + count + ')';
        updateThermostat(url);
    };

    /**
     * Calls function when slider handle is grabbed
     */
    $scope.sliderOnHandleDown = function() {
        $interval.cancel($scope.thermostats.interval);
    };


    /**
     * Calls function when slider handle is released
     * @param {string} cmd
     * @param {int} index
     */
    $scope.sliderOnHandleUp = function(v, index) {
        var url = v.urlChangeTemperature;
        var step = v.range.step;
        $scope.toggleRowSpinner(url);
        $scope.refreshZigbeeData();
        var count = parseFloat($scope.thermostats.rangeSlider[index]);
        var min = parseInt( v.range.min,1);
        var max = parseInt(v.range.max, 1);
        if (count < min) {
            count = min;
        }
        if (count > max) {
            count = max;
        }
        //count =  Math.round(count*2)/2;
        if((step % 1) === 0){//Step is a whole number
            count = Math.round(count);
        }else{//Step has a decimal place
            // Dec Number is > 5 - Rounding up
            // E.g.: 22.7 to 23
            if((count % 1) > step){
                count = Math.round(count);
            }
            // Dec Number is =< 5 - Rounding down + step
            // E.g.: 22.2 to 22.5
            else if((count % 1) > 0.0 && (count % 1) < 0.6){
                count = (Math.round(count) +step);
            }
        }

        $scope.thermostats.rangeSlider[index] = count;
        url += '.Set('+v.curThermMode+',' + count + ')';
        updateThermostat(url);
    };

    /// --- Private functions --- ///

    /**
     * Update thermostat
     * @param {string} url
     */
    function updateThermostat(url) {
        dataService.runZigbeeCmd(cfg.store_url + url).then(function (response) {
            $timeout($scope.toggleRowSpinner, 1000);
        }, function (error) {
            $scope.toggleRowSpinner();
            alertify.alertError($scope._t('error_update_data') + '\n' + url);
        });
    };

    /**
     * Set zigbee data
     * @param {object} ZigbeeAPIData
     */
    function setData(ZigbeeAPIData) {
        var controllerNodeId = ZigbeeAPIData.controller.data.nodeId.value;
        // Loop throught devices
        angular.forEach(ZigbeeAPIData.devices, function(node, nodeId) {
            if (nodeId == controllerNodeId) {
                return;
            }
            
            // Loop throught endpoints
            var cnt = 1;
            angular.forEach(node.endpoints, function(endpoint, endpointId) {
                //0x40 = 64
                //0x43 = 67
                var hasThermostatMode = deviceService.hasCommandClass(node,64,endpointId);
                var hasThermostatSetpoint = deviceService.hasCommandClass(node,67,endpointId);
                // we don't want devices without ThermostatSetpoint AND ThermostatMode CCs
                if (!hasThermostatSetpoint && !hasThermostatMode) {
                    return;
                }
                var ccId;
                var curThermMode = getCurrentThermostatMode(hasThermostatMode);
                var level = null;
                var hasExt = false;
                var updateTime;
                var invalidateTime;
                var modeType = null;
                var modeList = {};
                var scale = null;
                var isThermostatMode = false;
                var isThermostatSetpoint = false;
                var range = cfg.thermostat.c;
                // Command Class Thermostat Mode (0x40/64)
                if (hasThermostatMode) {
                    ccId = 0x40;
                    modeList = getModeList(hasThermostatMode.data);
                    if (curThermMode in hasThermostatMode.data) {
                        updateTime =  hasThermostatMode.data.mode.updateTime;
                        invalidateTime = hasThermostatMode.data.mode.invalidateTime;
                        modeType = 'hasThermostatMode';
                        isThermostatMode = true;

                    }
                }
                // Command Class Thermostat SetPoint (0x43/67)
                if (hasThermostatSetpoint) {
                    ccId = 0x43;
                    if (hasThermostatSetpoint.data[curThermMode]) {
                        level = hasThermostatSetpoint.data[curThermMode].setVal.value;
                        scale = hasThermostatSetpoint.data[curThermMode].scaleString.value;
                        updateTime = hasThermostatSetpoint.data[curThermMode].updateTime;
                        invalidateTime = hasThermostatSetpoint.data[curThermMode].invalidateTime;
                        hasExt = true;
                        modeType = 'hasThermostatSetpoint';
                        isThermostatSetpoint = true;
                        range = getMinMax(hasThermostatSetpoint.data[curThermMode],scale);
                    }

                }
                // Set object
                var obj = {};

                var thermostats = endpoint.clusters[ccId];

                obj['id'] = nodeId;
                obj['iId'] = endpointId;
                obj['idSort'] = $filter('zeroFill')(nodeId);
                obj['cmd'] = thermostats.name + '_' + nodeId + '_' + endpointId;
                obj['ccId'] = ccId;
                obj['rowId'] = thermostats.name + '_' + nodeId + '_' + endpointId;
                obj['name'] = $filter('deviceName')(nodeId, node);
                obj['curThermMode'] = curThermMode;
                obj['level'] = level;
                obj['scale'] = scale;
                obj['range'] = range;
                obj['hasExt'] = hasExt;
                obj['updateTime'] = updateTime;
                obj['invalidateTime'] = invalidateTime;
                obj['dateTime'] = $filter('getDateTimeObj')(obj['updateTime'],obj['invalidateTime']);
                obj['isUpdated'] = (updateTime > invalidateTime ? true : false);
                obj['urlToStore'] = 'devices[' + nodeId + '].endpoints[' + endpointId + '].clusters[' + 0x40 + ']'; // ThermostatMode 0x40
                obj['urlChangeTemperature'] = 'devices[' + nodeId + '].endpoints[' + endpointId + '].clusters[' + ccId + ']'; //ThermostatSetpoint 0x43
                obj['cmdToUpdate'] = 'devices[' + nodeId + '].endpoints[' + endpointId + '].clusters[' + ccId + '].data.' + curThermMode;
                obj['modeType'] = modeType;
                obj['isThermostatMode'] = isThermostatMode;
                obj['isThermostatSetpoint'] = isThermostatSetpoint;
                obj['modeList'] = modeList;

                var findIndex = _.findIndex($scope.thermostats.all, {rowId: obj.rowId});
                if(findIndex > -1){
                    angular.extend($scope.thermostats.all[findIndex],obj);
                    $scope.thermostats.rangeSlider[findIndex] = level;

                }else{
                    $scope.thermostats.all.push(obj);
                    $scope.thermostats.rangeSlider.push(obj['range_' + nodeId] = obj['level']);
                }
                if($scope.thermostats.ids.indexOf(nodeId) === -1){
                    $scope.thermostats.ids.push(nodeId);
                }
                cnt++;
            });
        });
    }

    /**
     * Used to pick up thermostat mode
     * @param {object} hasThermostatMode
     * @returns {number}
     */
    function getCurrentThermostatMode(hasThermostatMode) {
       var curThermMode = 1;
        if (hasThermostatMode) {
            curThermMode = hasThermostatMode.data.mode.value;
            if (isNaN(parseInt(curThermMode, 10)))
                curThermMode = null; // Mode not retrieved yet
        }
      /* else {
           // we pick up first available mode, since not ThermostatMode is supported to change modes
           curThermMode = null;
           angular.forEach(endpoint.clusters[0x43].data, function(name, k) {
               if (!isNaN(parseInt(name, 10))) {
                   curThermMode = parseInt(name, 10);
                   return false;
               }
           });
       }*/
        return curThermMode;
    };
    /**
     * Get min max values
     * @param {object} data
     * @returns {object}
     */
    function getMinMax(data,scale) {
        var range = (scale === '°F' ? cfg.thermostat.f : cfg.thermostat.c);
        // Has a min key and a max key?
        if((data.min && !isNaN(parseInt(data.min.value))) && (data.max && !isNaN(parseInt(data.max.value)))){
            // Is max bigger than min
            if(parseInt(data.max.value) > parseInt(data.min.value)){
                range.min = parseInt(data.min.value);
                range.max = parseInt(data.max.value);
            }
        }
        return range;

    }
    ;
    /**
     * Build a list with the thermostat modes
     * @param {object} data
     * @returns {object}
     */
    function getModeList(data) {
        var list = []
        angular.forEach(data, function(v, k) {
            if (!k || isNaN(parseInt(k, 10))) {
                return;
            }
            var obj = {};
            obj['key'] = k;
            obj['val'] = $filter('hasNode')(v, 'modeName.value');
            list.push(obj);
        });

        return list;
    }
    ;
});