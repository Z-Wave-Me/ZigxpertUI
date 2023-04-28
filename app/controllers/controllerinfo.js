/**
 * Application ControllerInfo controller
 * @author Martin Vach
 */
appController.controller('ControllerController', function($scope, $window, $filter, $interval,$timeout,cfg,dataService,deviceService) {
    $scope.funcList;
    $scope.ZigbeeAPIData;
    $scope.builtInfo = '';
    $scope.info = {};
    $scope.master = {};
    $scope.runQueue = false;
    $scope.controllerInfo = {
        interval: null
    }

    /**
     * Cancel interval on page destroy
     */
    $scope.$on('$destroy', function() {
        $interval.cancel($scope.controllerInfo.interval);
    });
    /**
     * Load app built info
     */
    $scope.loadAppBuiltInfo = function() {
        dataService.getAppBuiltInfo().then(function(response) {
            $scope.builtInfo = response.data;
        }, function(error) {});
    };
    $scope.loadAppBuiltInfo();

    /**
     * Load zigbee data
     */
    $scope.loadZigbeeData = function() {
        dataService.loadZigbeeApiData().then(function(ZigbeeAPIData) {
            setData(ZigbeeAPIData);
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
                setData(response.data.joined);
            });
        };
        $scope.controllerInfo.interval = $interval(refresh, $scope.cfg.interval);
    };
    
     /**
     *
     * Set debug mode
     */
    $scope.setDebugMode = function(status,spin) {
        var input = {
            debug: status
        };
        $scope.toggleRowSpinner(spin);
        dataService.postApi('configupdate_url', input).then(function (response) {
             $timeout($scope.toggleRowSpinner, 1000);
            $scope.loadZigbeeConfig(true);
        }, function (error) {
            $scope.toggleRowSpinner();
            alertify.alertError($scope._t('error_update_data'));
            return;
        });
    };

    /// --- Private functions --- ///
    /**
     * Set zigbee data
     * @param {object} ZigbeeAPIData
     */
    function setData(ZigbeeAPIData) {
        var nodeLimit = function(str) {
            return str === 'ff' ? $scope._t('unlimited') : str;
        };
        var caps = function(arr) {
            var cap = '';
            if (angular.isArray(arr)) {
                cap += (arr[3] & 0x01 ? 'S' : 's');
                cap += (arr[3] & 0x02 ? 'L' : 'l');
                cap += (arr[3] & 0x04 ? 'M' : 'm');
            }
            return cap;

        };
        $scope.ZigbeeAPIData = ZigbeeAPIData;
        $scope.master['controller.data.nodeId'] = ZigbeeAPIData.controller.data.nodeId.value;
        $scope.master['controller.data.panId'] = ZigbeeAPIData.controller.data.panId.value;
        $scope.master['controller.data.radioManufacturer'] = ZigbeeAPIData.controller.data.radioManufacturer.value;
        $scope.master['controller.data.radioBoardName'] = ZigbeeAPIData.controller.data.radioBoardName.value;
        $scope.master['controller.data.EzspVersion'] = ZigbeeAPIData.controller.data.EzspVersion.value;
        $scope.master['controller.data.APIVersion'] = ZigbeeAPIData.controller.data.EmberZNetVersionMajor.value + "." + ZigbeeAPIData.controller.data.EmberZNetVersionMinor.value;
        // TBD $scope.master['controller.data.uuid'] = ZigbeeAPIData.controller.data.uuid.value;
        // TBD $scope.master['controller.data.uuid16'] = ZigbeeAPIData.controller.data.uuid.value ? ZigbeeAPIData.controller.data.uuid.value.substring(16) : null;
        /* TBD
        if (ZigbeeAPIData.controller.data.firmware.caps.maxNodes.value) {
            $scope.master['controller.data.firmware.caps.subvendor'] = '0x' + dec2hex((ZigbeeAPIData.controller.data.firmware.caps.value[0] << 8) + ZigbeeAPIData.controller.data.firmware.caps.value[1]);
            $scope.master['controller.data.firmware.caps.nodes'] = ZigbeeAPIData.controller.data.firmware.caps.maxNodes.value;
            $scope.master['controller.data.firmware.caps.staticApi'] = ZigbeeAPIData.controller.data.firmware.caps.staticApi.value;
            $scope.master['controller.data.firmware.caps.maxPower'] = ZigbeeAPIData.controller.data.firmware.caps.maxPower.value;
            $scope.master['controller.data.firmware.caps.backup'] = ZigbeeAPIData.controller.data.firmware.caps.backup.value;
            $scope.master['controller.data.firmware.caps.wup'] = ZigbeeAPIData.controller.data.firmware.caps.wup.value;
            $scope.master['controller.data.firmware.caps.advancedIMA'] = ZigbeeAPIData.controller.data.firmware.caps.advancedIMA.value;
            $scope.master['controller.data.firmware.caps.longRange'] = ZigbeeAPIData.controller.data.firmware.caps.longRange.value;
            $scope.master['controller.data.firmware.caps.ultraUART'] = ZigbeeAPIData.controller.data.firmware.caps.ultraUART.value;
            $scope.master['controller.data.firmware.caps.swapSubvendor'] = ZigbeeAPIData.controller.data.firmware.caps.swapSubvendor.value;
            $scope.master['controller.data.firmware.caps.promisc'] = ZigbeeAPIData.controller.data.firmware.caps.promisc.value;
            $scope.master['controller.data.firmware.caps.zniffer'] = ZigbeeAPIData.controller.data.firmware.caps.zniffer.value;
            $scope.master['controller.data.firmware.caps.jammingDetection'] = ZigbeeAPIData.controller.data.firmware.caps.jammingDetection.value;
            $scope.master['controller.data.firmware.caps.pti'] = ZigbeeAPIData.controller.data.firmware.caps.pti.value;
            $scope.master['controller.data.firmware.caps.modem'] = ZigbeeAPIData.controller.data.firmware.caps.modem.value;
        } else {
            if (ZigbeeAPIData.controller.data.firmware.caps.value) {
                $scope.master['controller.data.firmware.caps.subvendor'] = '0x' + dec2hex((ZigbeeAPIData.controller.data.firmware.caps.value[0] << 8) + ZigbeeAPIData.controller.data.firmware.caps.value[1]);
                $scope.master['controller.data.firmware.caps.nodes'] = nodeLimit(dec2hex(ZigbeeAPIData.controller.data.firmware.caps.value[2]).slice(-2));
                $scope.master['controller.data.firmware.caps.cap'] = caps(ZigbeeAPIData.controller.data.firmware.caps.value);
            }
        }
        */
        $scope.master['controller.data.softwareRevisionVersion'] = ZigbeeAPIData.controller.data.softwareRevisionVersion.value;
        //$scope.master['controller.data.firmware.caps.crc.value'] = ZigbeeAPIData.controller.data.firmware.caps.crc.value;
        $scope.master['controller.data.softwareRevisionId'] = ZigbeeAPIData.controller.data.softwareRevisionId.value;
        $scope.master['controller.data.softwareRevisionDate'] = ZigbeeAPIData.controller.data.softwareRevisionDate.value;
        $scope.master['controller.data.softwareRevisionDate'] = ZigbeeAPIData.controller.data.softwareRevisionDate.value;

        /* TBD
        // Function list
        var funcList = '';
        var _fc = array_unique(ZigbeeAPIData.controller.data.capabilities.value.concat(ZigbeeAPIData.controller.data.functionClasses.value));
        _fc.sort(function(a, b) {
            return a - b
        });

        angular.forEach(_fc, function(func, index) {
            var fcIndex = ZigbeeAPIData.controller.data.functionClasses.value.indexOf(func);
            var capIndex = ZigbeeAPIData.controller.data.capabilities.value.indexOf(func);
            var fcName = (fcIndex != -1) ? ZigbeeAPIData.controller.data.functionClassesNames.value[fcIndex] : 'Not implemented';
            funcList += '<span style="color: ' + ((capIndex != -1) ? ((fcIndex != -1) ? '' : 'gray') : 'red') + '">' + fcName + ' (0x' + ('00' + func.toString(16)).slice(-2) + ')</span>  &#8226; ';
        });
        $scope.funcList = funcList;
        */
    }
    function dec2hex(i)
    {
        //return  ("0"+(Number(i).toString(16))).slice(-2).toUpperCase()
        var result = "0000";
        if (i >= 0 && i <= 15) {
            result = "000" + i.toString(16);
        }
        else if (i >= 16 && i <= 255) {
            result = "00" + i.toString(16);
        }
        else if (i >= 256 && i <= 4095) {
            result = "0" + i.toString(16);
        }
        else if (i >= 4096 && i <= 65535) {
            result = i.toString(16);
        }
        return result;
    }
});
