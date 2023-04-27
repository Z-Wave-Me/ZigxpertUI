/**
 * @overview This controller renders and handles active associations.
 * @author Martin Vach
 */

/**
 * Associations root controller
 * @class AssociationsController
 *
 */
appController.controller('AssociationsController', function($scope, $filter, $timeout,$interval,$http,dataService, deviceService,cfg,_,myCache) {
    $scope.devices = {
        all: [],
        show: false,
        interval: null,
        showLifeline: false
    };

    /**
     * Cancel interval on page destroy
     */
    $scope.$on('$destroy', function() {
        $interval.cancel($scope.devices.interval);
    });

    /**
     * Reset devices
     */
    /*$scope.reset = function() {
        $scope.devices.all = angular.copy([]);
    };*/

    /**
     * Load zigbee data
     */
    $scope.loadZigbeeData = function() {
        dataService.loadZigbeeApiData().then(function(ZigbeeAPIData) {
            setData(ZigbeeAPIData);
            if(_.isEmpty($scope.devices.all)){
                $scope.alert = {message: $scope._t('device_404'), status: 'alert-warning', icon: 'fa-exclamation-circle'};
                return;
            }
            $scope.devices.show = true;
            //$scope.refreshZigbeeData(ZigbeeAPIData);
        }, function(error) {
            alertify.alertError($scope._t('error_load_data'));
        });
    };
    $scope.loadZigbeeData();

    /**
     * todo: deprecated
     * Refresh zigbee data
     * @param {object} ZigbeeAPIData
     */
    /*$scope.refreshZigbeeData = function(ZigbeeAPIData) {
        var refresh = function() {
            dataService.loadJoinedZigbeeData().then(function(response) {
                setData(response.data.joined);
            }, function(error) {});
        };
        $scope.devices.interval = $interval(refresh, $scope.cfg.interval);
    };*/

    // Store data on remote server
    $scope.lifeline = function(status) {
        //$scope.reset();
        $scope.devices.showLifeline = status;
        $scope.loadZigbeeData();
    };
    /// --- Private functions --- ///

    /**
     * Set zigbee data
     * @param {obj} ZigbeeAPIData
     */
    function setData(ZigbeeAPIData) {
        var controllerNodeId = ZigbeeAPIData.controller.data.SUCNodeId.value || ZigbeeAPIData.controller.data.nodeId.value;
        // Loop through devices
        var cnt = 1;
        angular.forEach(ZigbeeAPIData.devices, function(node, nodeId) {
            if (deviceService.notDevice(ZigbeeAPIData, node, nodeId)) {
                return;
            }
            var zddXmlFile = $filter('hasNode')(node, 'data.ZDDXMLFile.value');
            var zdd = null;
            if (zddXmlFile) {
                dataService.xmlToJson(cfg.server_url + cfg.zddx_url + zddXmlFile).then(function (response) {
                    zdd = $filter('hasNode')(response, 'ZigbeeDevice.assocGroups');
                    setAssocDevices(nodeId,node, ZigbeeAPIData, zdd, controllerNodeId,cnt);
                });
            }else{
                setAssocDevices(nodeId,node, ZigbeeAPIData, zdd, controllerNodeId,cnt);
            }
            cnt++;
        });
    }

    /**
     * Set assoc devices
     * @param nodeId
     * @param node
     * @param ZigbeeAPIData
     * @param zdd
     * @param controllerNodeId
     * @param cnt
     */
    function setAssocDevices(nodeId,node, ZigbeeAPIData, zdd, controllerNodeId,cnt){
        var assocDevices = getAssocDevices(node, ZigbeeAPIData, zdd, controllerNodeId);
        var obj = {
            'id': nodeId,
            'idSort': $filter('zeroFill')(nodeId),
            'rowId': 'row_' + nodeId + '_' + cnt,
            'name': $filter('deviceName')(nodeId, node),
            'assocGroup': assocDevices
        };
        var findIndex = _.findIndex($scope.devices.all, {rowId: obj.rowId});
        if(findIndex > -1){
            angular.extend($scope.devices.all[findIndex],obj);
        }else{
            $scope.devices.all.push(obj);
        }
    }

    /**
     * Get group name
     * @param assocGroups
     * @param index
     * @param endpoint
     * @returns {string}
     */
    function getGroupLabel(assocGroups, index, endpoint) {
        // Set default assoc group name
        var label = $scope._t('association_group') + " " + (index + 1);

        // Attempt to get assoc group name from the zdd file
        var langs = $filter('hasNode')(assocGroups, 'description.lang');
        if (langs) {
            if ($.isArray(langs)) {
                angular.forEach(langs, function(lang, index) {
                    if (("__text" in lang) && (lang["_xml:lang"] == $scope.lang)) {
                        label = lang.__text;
                        return false;
                    }
                    if (("__text" in lang) && (lang["_xml:lang"] == "en")) {
                        label = lang.__text;
                    }
                });
            } else {
                if (("__text" in langs)) {
                    label = langs.__text;
                }
            }
        } else {
            // Attempt to get assoc group name from the command class
            angular.forEach(endpoint[0].clusters, function(v, k) {
                if (v.name == 'AssociationGroupInformation') {
                    label = $filter('hasNode')(v, 'data.' + (index + 1) + '.groupName.value');
                }

            });
        }

        return label;
    }
    ;
    /**
     * Get assoc devices
     * @param node
     * @param ZigbeeAPIData
     * @param zdd
     * @param controllerNodeId
     * @returns {Array}
     */
    function getAssocDevices(node, ZigbeeAPIData, zdd, controllerNodeId) {
        var assocGroups = [];
        var assocDevices = [];
        var assoc = [];
        var data;
        if (0x85 in node.endpoints[0].clusters) {
            var cc = node.endpoints[0].clusters[0x85].data;
            if (cc.groups.value >= 1) {
                for (var grp_num = 1; grp_num <= parseInt(cc.groups.value, 10); grp_num++) {
                    var groupArr = [];
                    var groupDev = [];
                    if (assocGroups.indexOf(grp_num) == -1) {
                        assocGroups.push(grp_num);
                    }

                    data = cc[grp_num];
                    for (var i = 0; i < data.nodes.value.length; i++) {
                        var targetNodeId = data.nodes.value[i];
                        var device = {
                            id: targetNodeId,
                            name: $filter('deviceName')(targetNodeId, ZigbeeAPIData.devices[targetNodeId]),
                        lifeline: targetNodeId === controllerNodeId
                        };
                        assocDevices.push({'group': grp_num, 'device': device});
                    }

                }
            }
        }

        if (0x8e in node.endpoints[0].clusters) {
            var cc = node.endpoints[0].clusters[0x8e].data;
            if (cc.groups.value >= 1) {
                for (var grp_num = 1; grp_num <= parseInt(cc.groups.value, 10); grp_num++) {
                    var groupDev = [];
                    if (assocGroups.indexOf(grp_num) == -1) {
                        assocGroups.push(grp_num);
                    }
                    data = cc[grp_num];

                    for (var i = 0; i < data.nodesInstances.value.length; i += 2) {
                        var targetNodeId = data.nodesInstances.value[i];
                        var targetInstanceId = data.nodesInstances.value[i + 1];
                        var endpointId = (targetInstanceId > 0 ? '.' + targetInstanceId : '')
                        var device = {
                            id: targetNodeId,
                            name:  $filter('deviceName')(targetNodeId, ZigbeeAPIData.devices[targetNodeId]),
                            lifeline: targetNodeId === controllerNodeId
                        };
                        assocDevices.push({'group': grp_num, 'device': device});
                    }
                }
            }
        }

        angular.forEach(assocGroups, function(v, k) {

            var dev = [];
            var name;

            if (zdd) {
                angular.forEach(zdd, function(zddval, zddkey) {
                    if (angular.isArray(zddval)) {
                        angular.forEach(zddval, function(val, key) {
                            if (val._number == v)
                                name = getGroupLabel(val, v, node.endpoints);
                        });
                    } else {
                        if (zddval._number == v)
                            name = getGroupLabel(zddval, v, node.endpoints);

                    }
                });
            } else {
                name = getGroupLabel([], v - 1, node.endpoints);
            }

            angular.forEach(assocDevices, function(d, key, nodeId) {
                if (d['group'] == v) {
                    if ($scope.devices.showLifeline) {
                        dev.push(d.device);
                    } else {
                        if (controllerNodeId != d.device.id) {
                            dev.push(d.device);
                        }
                    }
                }

            });

            if (dev.length > 0) {
                assoc.push({'name': name, 'devices': dev});
            }
        });

        return assoc;
    }


});