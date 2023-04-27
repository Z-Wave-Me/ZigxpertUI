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
        $scope.master['controller.data.homeId'] = ZigbeeAPIData.controller.data.homeId.value;
        $scope.master['controller.data.isPrimary'] = ZigbeeAPIData.controller.data.isPrimary.value;
        $scope.master['controller.data.isRealPrimary'] = ZigbeeAPIData.controller.data.isRealPrimary.value;
        $scope.master['controller.data.SUCNodeId'] = ZigbeeAPIData.controller.data.SUCNodeId.value;
        $scope.master['controller.data.SISPresent'] = ZigbeeAPIData.controller.data.SISPresent.value;
        $scope.master['controller.data.vendor'] = ZigbeeAPIData.controller.data.vendor.value;
        $scope.master['controller.data.manufacturerProductType'] = ZigbeeAPIData.controller.data.manufacturerProductType.value;
        $scope.master['controller.data.manufacturerProductId'] = ZigbeeAPIData.controller.data.manufacturerProductId.value;
        $scope.master['controller.data.manufacturerId'] = ZigbeeAPIData.controller.data.manufacturerId.value;
        $scope.master['controller.data.ZigbeeChip'] = ZigbeeAPIData.controller.data.ZigbeeChip.value;
        $scope.master['controller.data.libType'] = ZigbeeAPIData.controller.data.libType.value;
        $scope.master['controller.data.SDK'] = ZigbeeAPIData.controller.data.SDK.value;
        $scope.master['controller.data.majorSDK'] = ZigbeeAPIData.controller.data.SDK.value.split('.')[0];
        $scope.master['controller.data.APIVersion'] = ZigbeeAPIData.controller.data.APIVersion.value;
        $scope.master['controller.data.uuid'] = ZigbeeAPIData.controller.data.uuid.value;
        $scope.master['controller.data.uuid16'] = ZigbeeAPIData.controller.data.uuid.value ? ZigbeeAPIData.controller.data.uuid.value.substring(16) : null;
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
        $scope.master['controller.data.softwareRevisionVersion'] = ZigbeeAPIData.controller.data.softwareRevisionVersion.value;
        $scope.master['controller.data.firmware.caps.crc.value'] = ZigbeeAPIData.controller.data.firmware.caps.crc.value;
        $scope.master['controller.data.softwareRevisionId'] = ZigbeeAPIData.controller.data.softwareRevisionId.value;
        $scope.master['controller.data.softwareRevisionDate'] = ZigbeeAPIData.controller.data.softwareRevisionDate.value;
        $scope.master['controller.data.softwareRevisionDate'] = ZigbeeAPIData.controller.data.softwareRevisionDate.value;
        $scope.master['controller.data.frequency'] = ZigbeeAPIData.controller.data.frequency.value;

        // Texts
        $scope.master['txtHomeId'] = '';
        $scope.master['txtSucSis'] = '';
        setText($scope.master);

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
    // Get Queue updates
    function setText(master) {
        angular.forEach(master, function(v, k) {
            var src = {};
            switch (k) {
                case 'controller.data.SUCNodeId':
                    src['txtSucSis'] = (v != 0) ? (v.toString() + ' (' + (master['controller.data.SISPresent'] ? 'SIS' : 'SUC') + ')') : $scope._t('nm_suc_not_present');
                    angular.extend($scope.master, src);
                    break;
                case 'controller.data.homeId':
                    src['txtHomeId'] = '0x' + ('00000000' + (v + (v < 0 ? 0x100000000 : 0)).toString(16)).slice(-8);
                    ;
                    angular.extend($scope.master, src);
                    break;

                default:
                    break;
            }

        });
        return;

    }
});
