/**
 * @overview This controller renders and handles switches, actuators, electrical power switches, dimmers and motor controlling devices.
 * @author Martin Vach
 */

/**
 * Allows to control On/Off switches, actuators, electrical power switches and trap On/Off control commands from other devices.
 * Allows to control all actuators with multilevel switching functions, primarily Dimmers and Motor Controlling devices
 * as well as trap dim events sent by remotes.
 * Controls the behavior of a actuator on Switch All commands.
 *
 * @class SwitchController
 *
 */
appController.controller('SwitchController', function ($scope, $filter, $timeout, $interval, dataService, deviceService,cfg, _) {
    $scope.switches = {
        ids: [],
        all: [],
        interval: null,
        rangeSlider: [],
        switchButton: [],
        show: false
    };
    /**
     * Cancel interval on page destroy
     */
    $scope.$on('$destroy', function () {
        $interval.cancel($scope.switches.interval);
    });

    /**
     * Load zigbee data
     */
    $scope.loadZigbeeData = function () {
        dataService.loadZigbeeApiData().then(function (ZigbeeAPIData) {
            setData(ZigbeeAPIData);
            if (_.isEmpty($scope.switches.all)) {
                $scope.alert = {
                    message: $scope._t('device_404'),
                    status: 'alert-warning',
                    icon: 'fa-exclamation-circle'
                };
                return;
            }
            $scope.switches.show = true;
            $scope.refreshZigbeeData();
        }, function (error) {
            alertify.alertError($scope._t('error_load_data'));
        });
    };
    $scope.loadZigbeeData();

    /**
     * Refresh zigbee data
     */
    $scope.refreshZigbeeData = function () {
        var refresh = function () {
            dataService.loadJoinedZigbeeData().then(function (response) {
                var update = false;
                angular.forEach(response.data.update, function(v, k) {
                    // Get node ID from response
                    var findId = k.split('.')[1];
                    // Check if node ID is in the available devices
                    if($scope.switches.ids.indexOf(findId) > -1){
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
        $scope.switches.interval = $interval(refresh, $scope.cfg.interval);
    };

    /**
     * Update switch
     * @param {string} url
     */
    $scope.updateSwitch = function (url, $index) {
        $scope.toggleRowSpinner(url);
        dataService.runZigbeeCmd(cfg.store_url + url).then(function (response) {
            $timeout($scope.toggleRowSpinner, 1000);
        }, function (error) {
            $scope.toggleRowSpinner();
            alertify.alertError($scope._t('error_update_data') + '\n' + url);
        });
    };
    /**
     * Update all switches
     * @param {string} id
     * @param {string} urlType
     */
    $scope.updateAllSwitches = function (id, urlType) {
        var lastItem = _.last($scope.switches.all);
        $scope.toggleRowSpinner(id);
        angular.forEach($scope.switches.all, function (v, k) {
            $scope.toggleRowSpinner(v[urlType]);
            dataService.runZigbeeCmd(cfg.store_url + v[urlType]).then(function (response) {
                alertify.dismissAll();
            }, function (error) {
                alertify.dismissAll();
                alertify.alertError($scope._t('error_update_data') + '\n' + v[urlType]);
            });
            if (lastItem.rowId === v.rowId) {
                $timeout($scope.toggleRowSpinner, 1000);
            }
        });

    };

    /**
     * Calls function when slider handle is grabbed
     */
    $scope.sliderOnHandleDown = function () {
        $interval.cancel($scope.switches.interval);
    };

    /**
     * Calls function when slider handle is released
     * @param {string} cmd
     * @param {int} index
     */
    $scope.sliderOnHandleUp = function (cmd, index) {
        $scope.refreshZigbeeData(null);
        var val = $scope.switches.rangeSlider[index];
        var url = cmd + '(' + val + ')';
        dataService.runZigbeeCmd(cfg.store_url + url).then(function (response) {
            $scope.toggleRowSpinner();
        }, function (error) {
            $scope.toggleRowSpinner();
            alertify.alertError($scope._t('error_update_data') + '\n' + url);
        });
    };

    /// --- Private functions --- ///

    /**
     * Set zigbee data
     * @param {object} ZigbeeAPIData
     */
    function setData(ZigbeeAPIData) {

        /**
         * Set data for all available devices
         */
        var controllerNodeId = ZigbeeAPIData.controller.data.nodeId.value;
        // Loop through devices
        angular.forEach(ZigbeeAPIData.devices, function (node, nodeId) {
            if (nodeId == controllerNodeId) {
                return;
            }
            setNodeInstance(node, nodeId);

        });
    }
    ;
    /**
     * Set node endpoint
     * @param node
     * @param nodeId
     */
    function setNodeInstance(node, nodeId){
        // Loop throught endpoints
        var cnt = 0;
        angular.forEach(node.endpoints, function (endpoint, endpointId) {
            angular.forEach(endpoint.clusters, function (cluster, clusterId) {
                cnt++;

                var ccId = parseInt(clusterId, 10);
                
                // Set object
                var obj = {};

                // Motor devices
                var btnOn = $scope._t('switched_on');
                var btnOff = $scope._t('switched_off');
                var btnFull = $scope._t('btn_full');
                var hasMotor = false;
                /* TBD
                var motorDevices = ['17/3', '17/5', '17/6', '17/7', '9/0', ' 9/1'];
                if (motorDevices.indexOf(genspecType) !== -1) {
                    btnOn = $scope._t('btn_switched_up');
                    btnOff = $scope._t('btn_switched_down');
                    hasMotor = true;
                }
                */
                //console.log(nodeId + '.' + endpointId + ': ' + genspecType + ' motor: ' + hasMotor);

                var deviceType;
                var levelObj;
                var levelChangeFunc;
                switch (ccId) {
                    case 0x0006:
                        deviceType = "binary";
                        levelObj = cluster.data.onOff;
                        levelObjName = "onOff";
                        levelChangeFunc = "Set";
                        break;
                    case 0x0008:
                        deviceType = "multilevel";
                        levelObj = cluster.data.currentLevel;
                        levelObjName = "currentLevel";
                        levelChangeFunc = "MoveToLevelOnOff";
                        break;
                    default:
                        return;
                };
                
                var level = updateLevel(levelObj, ccId, btnOn, btnOff);
                obj['id'] = nodeId;
                obj['idSort'] = $filter('zeroFill')(nodeId);
                obj['cmd'] = cluster.data.name + '.level';
                obj['iId'] = endpointId;
                obj['ccId'] = ccId;
                obj['hasMotor'] = hasMotor;
                obj['multiChannel'] = false; // TBD
                obj['deviceType'] = deviceType;
                obj['genericType'] = 0; // TBD genericType;
                obj['specificType'] = 0; // TBD specificType;
                obj['rowId'] = 'switch_' + nodeId + '_' + $filter('zeroFill')(cnt);
                obj['name'] = $filter('deviceName')(nodeId, node);
                obj['updateTime'] = levelObj.updateTime;
                obj['invalidateTime'] = levelObj.invalidateTime;
                obj['dateTime'] = $filter('getDateTimeObj')(levelObj.updateTime, obj['invalidateTime']);
                obj['urlToStore'] = 'devices[' + nodeId + '].endpoints[' + endpointId + '].clusters[' + ccId + '].Get()';
                obj['isUpdated'] = ((obj['updateTime'] > obj['invalidateTime']) ? true : false);
                obj['level'] = level.level_cont;
                obj['levelColor'] = level.level_color;
                obj['levelStatus'] = level.level_status;
                obj['levelMax'] = level.level_max;
                obj['levelVal'] = level.level_val;
                obj['urlToOff'] = 'devices[' + nodeId + '].endpoints[' + endpointId + '].clusters[' + ccId + '].' + levelChangeFunc + '(0)';
                obj['urlToOn'] = 'devices[' + nodeId + '].endpoints[' + endpointId + '].clusters[' + ccId + '].' + levelChangeFunc + '(255)';
                obj['urlToFull'] = 'devices[' + nodeId + '].endpoints[' + endpointId + '].clusters[' + ccId + '].' + levelChangeFunc + '(255)';
                obj['urlToSlide'] = 'devices[' + nodeId + '].endpoints[' + endpointId + '].clusters[' + ccId + '].' + levelChangeFunc;
                obj['btnOn'] = btnOn;
                obj['btnOff'] = btnOff;
                obj['btnFull'] = btnFull;
                obj['cmdToUpdate'] = 'devices.' + nodeId + '.endpoints.' + endpointId + '.clusters.' + ccId + '.data.' + levelObjName;
                // obj['deviceIcon'] = $filter('deviceIcon')(obj);
                var findIndex = _.findIndex($scope.switches.all, {rowId: obj.rowId});
                if (findIndex > -1) {
                    angular.extend($scope.switches.all[findIndex], obj);
                    $scope.switches.rangeSlider[findIndex] = level.level_val;

                } else {
                    $scope.switches.all.push(obj);
                    $scope.switches.rangeSlider.push(obj['range_' + nodeId] = level.level_val);
                }
                // Push available device id to an array
                if($scope.switches.ids.indexOf(nodeId) === -1){
                    $scope.switches.ids.push(nodeId);
                }
            });
        });
    }

    /**
     * Update level
     * @param {object} obj
     * @param {number}  ccId
     * @param {string} btnOn
     * @param {string} btnOff
     * @returns {{level_cont: *, level_color: *, level_status: string, level_val: number, level_max: number}}
     */
    function updateLevel(obj, ccId, btnOn, btnOff) {

        var level_cont;
        var level_color;
        var level_status = 'off';
        var level_val = 0;
        var level_max = 255;

        //var level = obj.value;
        var level = (angular.isDefined(obj.value) ? obj.value : null);

        if (level === '' || level === null) {
            level_cont = '?';
            level_color = 'gray';
        } else {
            if (level === false)
                level = 0;
            if (level === true)
                level = 255;
            level = parseInt(level, 10);
            if (level === 0) {
                level_cont = btnOff;
                level_color = '#a94442';
            } else if (level === 255) {
                level_status = 'on';
                level_cont = btnOn;
                level_color = '#3c763d';
                level_val = level;
            } else {
                level_cont = level.toString() + ((ccId == 0x0008) ? '%' : '');
                var lvlc_r = ('00' + parseInt(0x9F + 0x60 * level / 99).toString(16)).slice(-2);
                var lvlc_g = ('00' + parseInt(0x7F + 0x50 * level / 99).toString(16)).slice(-2);
                level_color = '#' + lvlc_r + lvlc_g + '00';
                level_status = 'on';
                level_val = level;
            }
        }
        ;
        return {
            "level_cont": level_cont,
            "level_color": level_color,
            "level_status": level_status,
            "level_val": level_val,
            "level_max": level_max
        };
    }
    ;
});