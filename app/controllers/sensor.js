/**
 * @overview This controller renders and handles sensors.
 * @author Martin Vach
 */

/**
 * Allows receive binary sensor states.
 * Allows to read different kind of sensor.
 * Allows to read different kind of meters.
 * @class SensorsController
 *
 */
appController.controller('SensorsController', function($scope, $filter, $timeout,$interval,cfg,dataService,_) {
    $scope.sensors = {
        ids: [],
        all: [],
        interval: null,
        show: false
    };
    /**
     * Cancel interval on page destroy
     */
    $scope.$on('$destroy', function() {
        $interval.cancel($scope.sensors.interval);
    });

    /**
     * Load zigbee data
     */
    $scope.loadZigbeeData = function() {
        dataService.loadZigbeeApiData().then(function(ZigbeeAPIData) {
            setData(ZigbeeAPIData);
            if(_.isEmpty($scope.sensors.all)){
                $scope.alert = {message: $scope._t('device_404'), status: 'alert-warning', icon: 'fa-exclamation-circle'};
                return;
            }
            $scope.sensors.show = true;
            $scope.refreshZigbeeData();
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
                    if($scope.sensors.ids.indexOf(findId) > -1){
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
        $scope.sensors.interval = $interval(refresh, $scope.cfg.interval);
    };

    /**
     * Update sensor
     * @param {string} url
     */
    $scope.updateSensor = function(id,url) {
        $scope.toggleRowSpinner(id);
        dataService.runZigbeeCmd(cfg.store_url + url).then(function (response) {
            $timeout($scope.toggleRowSpinner, 1000);
        }, function (error) {
            $scope.toggleRowSpinner();
            alertify.alertError($scope._t('error_update_data') + '\n' + url);
        });
    };

    /**
     * Update all sensors
     * @param {string} id
     * @param {string} urlType
     */
    $scope.updateAllSensors = function(id,urlType) {
        var lastItem = _.last($scope.sensors.all);
        $scope.toggleRowSpinner(id);
        angular.forEach($scope.sensors.all, function(v, k) {
            $scope.toggleRowSpinner(v.cmdToUpdate);
            dataService.runZigbeeCmd(cfg.store_url + v[urlType]).then(function (response) {
                alertify.dismissAll();
            }, function (error) {
                alertify.dismissAll();
                alertify.alertError($scope._t('error_update_data') + '\n' +  v[urlType]);
            });
            if(lastItem.rowId === v.rowId){
                $timeout($scope.toggleRowSpinner, 1000);
            }
        });

    };

    /// --- Private functions --- ///

    /**
     * Set zigbee data
     * @param {object} ZigbeeAPIData
     */
    function setData(ZigbeeAPIData) {
        $scope.updateTime = ZigbeeAPIData.updateTime;
        $scope.controllerId = ZigbeeAPIData.controller.data.nodeId.value;

        var cnt = 0;
        // Loop through devices
        angular.forEach(ZigbeeAPIData.devices, function(device, k) {
            if (k == 255 || k == $scope.controllerId || device.data.isVirtual.value) {
                return false;
            }
            // Loop through endpoints
            angular.forEach(device.endpoints, function(endpoint, endpointId) {
                if (endpointId == 0 && device.endpoints.length > 1) {
                    return;
                }
                // Command Class SensorBinary (0x30/48)
                var sensorBinary = endpoint.clusters[0x30];

                if (angular.isObject(sensorBinary)) {
                    angular.forEach(sensorBinary.data, function(val, key) {
                        // Not a sensor type
                        var sensor_type = parseInt(key, 10);
                        if (isNaN(sensor_type)) {
                            return;
                        }
                        var devName = $filter('deviceName')(k, device);
                        // Set object
                        var obj = {};
                        obj['id'] = k;
                        obj['idSort'] = $filter('zeroFill')(k);
                        obj['iId'] = endpointId;
                        obj['cmd'] = sensorBinary.data.name + '.' + val.name;
                        obj['cmdId'] = '48';
                        obj['rowId'] = sensorBinary.name + '_' + k + '_' + endpointId + '_' + sensor_type;
                        obj['name'] = devName;
                        obj['type'] = sensorBinary.name;
                        obj['purpose'] = val.sensorTypeString.value;
                        obj['level'] = (val.level.value ? '<span class="sensor-triggered">' + $scope._t('sensor_triggered') + '</span>' : $scope._t('sensor_idle'));
                        obj['html'] = true;
                        obj['levelExt'] = null;
                        obj['invalidateTime'] = val.invalidateTime;
                        obj['updateTime'] = val.updateTime;
                        obj['isUpdated'] = ((obj['updateTime'] > obj['invalidateTime']) ? true : false);
                        obj['dateTime'] = $filter('getDateTimeObj')(val.updateTime,obj['invalidateTime']);
                        obj['urlToStore'] = 'devices[' + obj['id'] + '].endpoints[' + endpointId + '].clusters[48].Get()';
                        obj['cmdToUpdate'] = 'devices.' + obj['id'] + '.endpoints.' + endpointId + '.clusters.48.data.' + sensor_type;
                        var findIndex = _.findIndex($scope.sensors.all, {rowId: obj.rowId});
                        if(findIndex > -1){
                            angular.extend($scope.sensors.all[findIndex],obj);

                        }else{
                            $scope.sensors.all.push(obj);
                        }
                        if($scope.sensors.ids.indexOf(k) === -1){
                            $scope.sensors.ids.push(k);
                        }
                    });
                }


                // Command Class SensorMultilevel (0x31/49)
                var sensorMultilevel = endpoint.clusters[0x31];
                if (angular.isObject(sensorMultilevel)) {
                    angular.forEach(sensorMultilevel.data, function(val, key) {
                        // Not a sensor type
                        var sensor_type = parseInt(key, 10);
                        if (isNaN(sensor_type)) {
                            return;
                        }

                        obj = endpoint.clusters[0x31];
                        var devName = $filter('deviceName')(k, device);
                        // Check for clusters data
                        var obj = {};
                        obj['id'] = k;
                        obj['iId'] = endpointId;
                        obj['cmd'] = sensorMultilevel.data.name + '.' + val.name;
                        obj['cmdId'] = '49';
                        obj['rowId'] = sensorMultilevel.name + '_' + k + '_' + endpointId + '_' + sensor_type;
                        obj['name'] = devName;
                        obj['type'] = sensorMultilevel.name;
                        obj['purpose'] = val.sensorTypeString.value;
                        obj['level'] = val.val.value;
                        obj['levelExt'] = val.scaleString.value;
                        obj['invalidateTime'] = val.invalidateTime;
                        obj['updateTime'] = val.updateTime;
                        obj['isUpdated'] = ((obj['updateTime'] > obj['invalidateTime']) ? true : false);
                        obj['dateTime'] = $filter('getDateTimeObj')(val.updateTime,obj['invalidateTime']);
                        obj['urlToStore'] = 'devices[' + obj['id'] + '].endpoints[' + endpointId + '].clusters[49].Get()';
                        obj['cmdToUpdate'] = 'devices.' + obj['id'] + '.endpoints.' + endpointId + '.clusters.49.data.' + sensor_type;
                        var findIndex = _.findIndex($scope.sensors.all, {rowId: obj.rowId});
                        if(findIndex > -1){
                            angular.extend($scope.sensors.all[findIndex],obj);

                        }else{
                            $scope.sensors.all.push(obj);

                        }
                        if($scope.sensors.ids.indexOf(k) === -1){
                            $scope.sensors.ids.push(k);
                        }
                    });
                }

                // Command Class Meter (0x32/50)
                var meters = endpoint.clusters[0x32];
                if (angular.isObject(meters)) {
                    angular.forEach(meters.data, function(meter, key) {
                        realEMeterScales = [0, 1, 3, 8, 9];// Not in [0, 1, 3, 8, 9] !== -1
                        var sensor_type = parseInt(key, 10);
                        if (isNaN(sensor_type)) {
                            return;
                        }

                        if (meter.sensorType.value == 1 && realEMeterScales.indexOf(sensor_type) != -1) {
                            return; // filter only for eMeters
                        }
                        if (meter.sensorType.value > 1) {
                            return; //  gas and water have real meter scales
                        }
                        var devName = $filter('deviceName')(k, device);
                        var obj = {};

                        obj['id'] = k;
                        obj['iId'] = endpointId;
                        obj['cmd'] = meters.data.name + '.' + meter.name;
                        obj['cmdId'] = '50';
                        obj['rowId'] = meters.name + '_' + k + '_' + endpointId + '_' + sensor_type;
                        obj['name'] = devName;
                        obj['type'] = meters.name;
                        obj['purpose'] = meter.sensorTypeString.value;
                        obj['level'] = meter.val.value;
                        obj['levelExt'] = meter.scaleString.value;
                        obj['invalidateTime'] = meter.invalidateTime;
                        obj['updateTime'] = meter.updateTime;
                        obj['isUpdated'] = ((obj['updateTime'] > obj['invalidateTime']) ? true : false);
                        obj['dateTime'] = $filter('getDateTimeObj')(meter.updateTime,obj['invalidateTime']);
                        obj['urlToStore'] = 'devices[' + obj['id'] + '].endpoints[' + endpointId + '].clusters[50].Get()';
                        obj['cmdToUpdate'] = 'devices.' + obj['id'] + '.endpoints.' + endpointId + '.clusters.50.data.' + sensor_type;
                        var findIndex = _.findIndex($scope.sensors.all, {rowId: obj.rowId});
                        if(findIndex > -1){
                            angular.extend($scope.sensors.all[findIndex],obj);

                        }else{
                            $scope.sensors.all.push(obj);
                            $scope.sensors.ids.push(k);
                        }
                        if($scope.sensors.ids.indexOf(k) === -1){
                            $scope.sensors.ids.push(k);
                        }
                    });
                }
                // Command Class Alarm Sensor (0x9C/156)
                // todo: Deprecated Command Class. Now Alarm/Notication is used instead.
                var alarmSensor = endpoint.clusters[0x9c];
                if (angular.isObject(alarmSensor)) {
                    //return;
                    angular.forEach(alarmSensor.data, function(val, key) {
                        // Not a sensor type
                        var sensor_type = parseInt(key, 10);
                        if (isNaN(sensor_type)) {
                            return;
                        }
                        var devName = $filter('deviceName')(k, device);
                        // Set object
                        var obj = {};
                        obj['id'] = k;
                        obj['iId'] = endpointId;
                        obj['cmd'] = alarmSensor.data.name + '.' + val.name;
                        obj['cmdId'] = '0x9c';
                        obj['rowId'] = alarmSensor.name + '_' + k + '_' + endpointId + '_' + sensor_type;
                        obj['name'] = devName;
                        obj['type'] = alarmSensor.name;
                        obj['purpose'] = val.typeString.value;
                        obj['level'] = (val.sensorState.value ? '<span class="sensor-triggered">' + $scope._t('sensor_triggered') + '</span>' : $scope._t('sensor_idle'));
                        obj['html'] = true;
                        obj['levelExt'] = null;
                        obj['invalidateTime'] = val.invalidateTime;
                        obj['updateTime'] = val.updateTime;
                        obj['dateTime'] = $filter('getDateTimeObj')(val.updateTime,obj['invalidateTime']);
                        obj['isUpdated'] = ((obj['updateTime'] > obj['invalidateTime']) ? true : false);
                        obj['urlToStore'] = 'devices[' + obj['id'] + '].endpoints[' + endpointId + '].clusters[156].Get()';
                        obj['cmdToUpdate'] = 'devices.' + obj['id'] + '.endpoints.' + endpointId + '.clusters.156.data.' + sensor_type;
                        var findIndex = _.findIndex($scope.sensors.all, {rowId: obj.rowId});
                        if(findIndex > -1){
                            angular.extend($scope.sensors.all[findIndex],obj);

                        }else{
                            $scope.sensors.all.push(obj);
                        }
                        if($scope.sensors.ids.indexOf(k) === -1){
                            $scope.sensors.ids.push(k);
                        }

                    });
                }

            });

        });
    }
});