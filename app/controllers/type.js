/**
 * @overview This controller renders and handles device types.
 * @author Martin Vach
 */

/**
 * Device type root controller
 * @class TypeController
 *
 */
appController.controller('TypeController', function($scope, $filter, $timeout,$interval,$q,dataService, cfg,_,deviceService) {
    $scope.devices = {
        ids: [],
        all: [],
        show: false,
        interval: null
    };

    $scope.deviceClasses = [];
    $scope.productNames = [];
    $scope.isController = false;

    /**
     * Cancel interval on page destroy
     */
    $scope.$on('$destroy', function() {
        $interval.cancel($scope.devices.interval);
    });

    /**
     * Load all promises
     * @returns {undefined}
     */
    $scope.allSettled = function () {
        var promises = [
            dataService.xmlToJson(cfg.server_url + cfg.device_classes_url),
            dataService.loadZigbeeApiData()
        ];

        $q.allSettled(promises).then(function (response) {
            // console.log(response)
            var deviceClasses = response[0];
            var zigbeeData = response[1];
            $scope.loading = false;

            // deviceClasses error message
            if (deviceClasses.state === 'rejected') {
                alertify.alertError($scope._t('error_load_data') + ':' + cfg.server_url + cfg.device_classes_url);
            }

            // zigbeeData error message
            if (zigbeeData.state === 'rejected') {
                alertify.alertError($scope._t('error_load_data'));
                return;
            }
            // Success - deviceClasses
            if (deviceClasses.state === 'fulfilled') {
                setDeviceClasses(deviceClasses.value);
            }

            // Success - zigbeeData
            if (zigbeeData.state === 'fulfilled') {
                setData(zigbeeData.value);
                if(_.isEmpty($scope.devices.all)){
                    $scope.alert = {message: $scope._t('device_404'), status: 'alert-warning', icon: 'fa-exclamation-circle'};
                    return;
                }
                $scope.devices.show = true;
                $scope.refreshZigbeeData();
            }

        });

    };
    $scope.allSettled();

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
                    if($scope.devices.ids.indexOf(findId) > -1){
                        update = true;
                        return;
                    }
                });
                // Update found - updating available devices
                if(update){
                    setData(response.data.joined);
                }
                //setData(response.data.joined);
            });
        };
        $scope.devices.interval = $interval(refresh, $scope.cfg.interval);
    };

    /// --- Private functions --- ///
    /**
     * Set device classess
     * @param {object} data
     * @returns {void}
     */
    function setDeviceClasses(data) {
        angular.forEach(data.DeviceClasses.Generic, function(val) {
            var obj = {};
            obj['id'] = parseInt(val._id);
            obj['generic'] = deviceService.configGetZddxLang(val.name.lang, $scope.lang);
            obj['specific'] = val.Specific;
            $scope.deviceClasses.push(obj);
        });
    }

    /**
     * Set zigbee data
     * @param {object} ZigbeeAPIData
     */
    function setData(ZigbeeAPIData) {
        var controllerNodeId = ZigbeeAPIData.controller.data.nodeId.value;
        // Loop throught devices
        angular.forEach(ZigbeeAPIData.devices, function(node, nodeId) {
            if (deviceService.notDevice(ZigbeeAPIData, node, nodeId)) {
                return;
            }
            if (parseInt(nodeId, 10) === cfg.controller.zbeeNodeId) {
                $scope.isController = true;
            }

            var node = ZigbeeAPIData.devices[nodeId];
            var basicType = node.data.basicType.value;
            var genericType = node.data.genericType.value;
            var specificType = node.data.specificType.value;
            var major = node.data.ZWProtocolMajor.value;
            var minor = node.data.ZWProtocolMinor.value;
            var isController = (controllerNodeId == nodeId);
            var vendorName = isController? ZigbeeAPIData.controller.data.vendor.value : node.data.vendorString.value;
            var zddXmlFile = $filter('hasNode')(node, 'data.ZDDXMLFile.value');
            //var productName = null;
            var fromSdk = true;
            var sdk;
            // SDK
            if ((node.data.SDK && node.data.SDK.value!== '') || (isController && ZigbeeAPIData.controller.data.SDK && ZigbeeAPIData.controller.data.SDK.value !== '')) {
                sdk = isController? ZigbeeAPIData.controller.data.SDK.value : node.data.SDK.value;
            } else {
                //sdk = major + '.' + minor;
                sdk = major + '.' + tranformTwoDigits(minor);
                fromSdk = false;
            }
            // Version
            var appVersion = node.data.applicationMajor.value + '.' + tranformTwoDigits(node.data.applicationMinor.value);
            // Security
            var security = false;
            // Security type
            var securityType = 'security-0';
            var hasSecurityCc = deviceService.hasCommandClass(node,152);
            if(hasSecurityCc){
                security = $filter('hasNode')(hasSecurityCc,'data.interviewDone.value') && !$filter('hasNode')(hasSecurityCc,'data.securityAbandoned.value') && $filter('hasNode')(node,'data.secureChannelEstablished.value');
                if (security) {
                    securityType = 'security-1';
                }
            }
            // Security S2
            var hasSecurityS2Cc = deviceService.hasCommandClass(node,159);
            var securityS2Key = [];
            if (hasSecurityS2Cc){
                security = $filter('hasNode')(hasSecurityS2Cc,'data.interviewDone.value') && !$filter('hasNode')(hasSecurityS2Cc,'data.securityAbandoned.value') && $filter('hasNode')(node,'data.secureChannelEstablished.value');
                if (security) {
                    securityType = 'security-2';
                }
                securityS2Key = deviceService.getS2GrantedKeys(hasSecurityS2Cc);
            } else {
                if ($filter('hasNode')(deviceService.hasCommandClass(node, 152),'data.security.value')) {
                    securityS2Key = ['S0']
                }
            }

            // todo: deprecated
            // DDR
            /*var ddr = false;
            if (angular.isDefined(node.data.ZDDXMLFile)) {
                ddr = node.data.ZDDXMLFile.value;
            }*/

            // Zigbee plus
            var hasZigbeePlusInfoCc = deviceService.hasCommandClass(node,94);
            var ZigbeePlusInfo = false;
            if(deviceService.hasCommandClass(node,94)){
                ZigbeePlusInfo = true;
            }
            // MWI and EF
            var mwief = getEXFrame(major, minor);
            if(ZigbeePlusInfo){
                mwief = 1;
            }
            // Device type
            var deviceXml = $scope.deviceClasses;
            var deviceType = $scope._t('unknown_device_type') + ': ' + genericType;
            angular.forEach(deviceXml, function(v) {
                if (genericType == v.id) {
                    deviceType = v.generic;
                    angular.forEach(v.specific, function(s) {
                        if (specificType == s._id) {
                            deviceType = deviceService.configGetZddxLang(s.name.lang, $scope.lang);
                        }
                    });

                }
            });

            // Set object
            var obj = {};
            obj['id'] = nodeId;
            obj['idSort'] = $filter('zeroFill')(nodeId);
            obj['rowId'] = 'row_' + nodeId;
            obj['name'] = $filter('deviceName')(nodeId, node);
            obj['hasSecurityS2Cc'] = hasSecurityS2Cc;
            obj['securityType'] = securityType;
            obj['security'] = security;
            obj['securityS2Key'] = securityS2Key.join();
            obj['mwief'] = mwief;
           // obj['ddr'] = ddr;
            obj['ZigbeePlusInfo'] = ZigbeePlusInfo;
            obj['sdk'] = (sdk == '0.00' || sdk == '0.0' ? '?' : sdk);
            obj['fromSdk'] = fromSdk;
            obj['appVersion'] = appVersion;
            obj['type'] = deviceType;
            obj['deviceType'] = deviceType;
            obj['basicType'] = basicType;
            obj['genericType'] = genericType;
            obj['specificType'] = specificType;
            obj['vendorName'] = vendorName;

            var findIndex = _.findIndex($scope.devices.all, {rowId: obj.rowId});
            if(findIndex > -1){
                angular.extend($scope.devices.all[findIndex],obj);

            }else{
                $scope.devices.all.push(obj);
                // Product name from zddx file
                if (zddXmlFile) {
                    dataService.xmlToJson(cfg.server_url + cfg.zddx_url + zddXmlFile).then(function (response) {
                        $scope.productNames[nodeId] = response.ZigbeeDevice.deviceDescription.productName;
                    });
                }

            }
            if($scope.devices.ids.indexOf(nodeId) === -1){
                $scope.devices.ids.push(nodeId);
            }

        });
    }

    function tranformTwoDigits (number) {
        return ("0" + number).slice(-2);
    }

    /**
     * Get EXF frame
     * @param {number} $major
     * @param {number} $minor
     * @returns {number}
     */
    function getEXFrame($major, $minor) {
        if ($major == 1)
            return 0;
        if ($major == 2) {
            if ($minor >= 96)
                return 1;
            if ($minor == 74)
                return 1;
            return 0;
        }
        if ($major == 3)
            return 1;
        return 0;
    }

});
