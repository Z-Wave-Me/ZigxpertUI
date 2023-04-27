/**
 * @overview This controller renders and handles device association stuff.
 * @author Martin Vach
 */

/**
 * Device configuration Association controller
 * @class ConfigAssocController
 *
 */
appController.controller('ConfigAssocController', function($scope, $filter, $routeParams, $location, $cookies, $timeout, $window,$interval, dataService, deviceService, myCache, cfg, _) {
    $scope.devices = [];
    $scope.deviceName = '';
    $scope.deviceId = 0;
    //$scope.activeTab = 'association';
    $scope.activeUrl = 'configuration/association/';
    $cookies.tab_config = 'association';

    $scope.alert = {message: false, status: 'is-hidden', icon: false};
    // Assoc vars
    $scope.node = [];
    $scope.nodeCfg = {
        id: 0,
        endpoint: 0,
        hasMCA: false,
        name: null,
        hasBattery: false,
        isAwake: false,
        notAwake: []

    };
    $scope.assocGroups = [];
    $scope.assocGroupsDevices = {};
    $scope.assocAddDevices = [];
    $scope.assocAddInstances = false;
    $scope.cfgXml = {};
    $scope.input = {
        nodeId: 0,
        //goupId: 0,
        toNode: false,
        toInstance: false
    };
    $scope.assocInterval = false;


    /**
     * Cancel interval on page destroy
     */
    $scope.$on('$destroy', function() {
        $interval.cancel($scope.assocInterval);
    });

    // Redirect to device
    $scope.redirectToDevice = function (deviceId) {
        if (deviceId) {
            $location.path($scope.activeUrl + deviceId);
        }
    };

    // Load data
    $scope.loadZigbeeData = function(nodeId, noCache) {
        dataService.loadZigbeeApiData().then(function(ZigbeeAPIData) {
            $scope.ZigbeeAPIData = ZigbeeAPIData;
            $scope.devices = deviceService.configGetNav(ZigbeeAPIData);
            if(_.isEmpty($scope.devices)){
                $scope.alert = {message: $scope._t('device_404'), status: 'alert-warning', icon: 'fa-exclamation-circle'};
                return;
            }
            var node = ZigbeeAPIData.devices[nodeId];
            if (!node || deviceService.notDevice(ZigbeeAPIData, node, nodeId)) {
                return;
            }
            $scope.node = node;
            angular.extend($scope.nodeCfg, {
                id: nodeId,
                hasMCA: 142 in node.endpoints[0].clusters,
                name: $filter('deviceName')(nodeId, node),
                hasBattery: 0x80 in node.endpoints[0].clusters,
            });
            $scope.input.nodeId = nodeId;

            $cookies.configuration_id = nodeId;
            $cookies.config_url = $scope.activeUrl + nodeId;
            $scope.deviceId = nodeId;
            $scope.deviceName = $filter('deviceName')(nodeId, node);
            dataService.getCfgXml().then(function (cfgXml) {
                $scope.cfgXml = cfgXml;
                setData(node, ZigbeeAPIData, nodeId, cfgXml);
            }, function(error) {
                setData(node, ZigbeeAPIData, nodeId, {});
            });


        }, noCache);
    };
    $scope.loadZigbeeData($routeParams.nodeId);

    /**
     * Refresh zigbee data
     */
    $scope.refreshZigbeeData = function() {
        var refresh = function() {
            dataService.loadJoinedZigbeeData().then(function(response) {
                var updateData = false;
                var searchStr = 'devices.' + $routeParams.nodeId + '.'
                angular.forEach(response.data.update, function(v, k) {
                    if (k.indexOf(searchStr) !== -1) {
                        updateData = true;
                        return;
                    }
                });
                if (updateData) {
                    $scope.loadZigbeeData($routeParams.nodeId, false);
                }
            });
        };
        $scope.assocInterval = $interval(refresh, cfg.interval);
    };

    $scope.refreshZigbeeData();

    // Update data from device
    $scope.updateFromDevice = function(spin) {

        var nodeId = $scope.deviceId;
        var node = $scope.node;
        $scope.toggleRowSpinner(spin);
        angular.forEach(node.endpoints, function(endpoint, index) {
            if (!("clusters" in endpoint)) {
                return;
            }
            if (0x85 in endpoint.clusters) {
                for (var group = 0; group < endpoint.clusters[0x85].data.groups.value; group++) {
                   dataService.runZigbeeCmd(cfg.store_url + 'devices[' + nodeId + '].endpoints[' + index + '].clusters[0x85].Get(' + (group + 1) + ')', false, $scope._t('error_handling_data'), true);
                }
            }
            if (0x8e in endpoint.clusters) {
                for (var group = 0; group < endpoint.clusters[0x8e].data.groups.value; group++) {
                    dataService.runZigbeeCmd(cfg.store_url + 'devices[' + nodeId + '].endpoints[' + index + '].clusters[0x8e].Get(' + (group + 1) + ')', false, $scope._t('error_handling_data'), true);

                }
            }
            $timeout(function() {
                $scope.toggleRowSpinner();
            }, 3000);
            return;


        });
    };

    //Show modal window with a list of the devices to assocciate
    $scope.handleAssocModal = function(modal,$event,group) {
        $scope.input.groupCfg = group;
        $scope.input.endpoint = group.endpoint;
        $scope.input.groupId = group.groupId;
        $scope.assocAddDevices = [];
        // Prepare devices and nodes
        console.log($scope.ZigbeeAPIData.devices);
        angular.forEach($scope.ZigbeeAPIData.devices, function(node, nodeId) {
            if (nodeId == $scope.deviceId) {
                return;
            }
            var obj = {};
            obj['id'] = nodeId;
            obj['name'] = $filter('deviceName')(nodeId, node);
            obj['hasMC'] = 96 in node.endpoints[0].clusters;
            obj['endpoints'] = getNodeInstances(node, nodeId);
            // deprecated remove 12.2021
            // if ($scope.nodeCfg.hasMCA) {
            //     if (obj['hasMC']) {
            //         $scope.assocAddDevices.push(obj);
            //     } else {
            //         if (group.nodeIds.indexOf(parseInt(nodeId)) === -1) {
            //             $scope.assocAddDevices.push(obj);
            //         }
            //     }
            // } else {
            //     if (group.nodeIds.indexOf(parseInt(nodeId)) === -1) {
            $scope.assocAddDevices.push(obj);
                // }
            // }
        });
        $scope.handleModal(modal,$event);

    };
    //Close  assoc  modal window
    $scope.closeAssocModal = function() {
        $scope.handleModal();

        $scope.input.toNode = false;
        $scope.input.toInstance = false;
        $scope.input.groupId = 0;
        $scope.assocAddInstances = false;
        $scope.assocAddDevices = angular.copy([]);
        $timeout(function() {
            $scope.toggleRowSpinner();
            $scope.loadZigbeeData($scope.nodeCfg.id);
        }, 3000);

    };
    //Show node endpoints (if any)
    $scope.showAssocNodeInstance = function(nodeId, hasMCA) {
        if (!hasMCA) {
            return;
        }
        // Prepare devices and nodes
        angular.forEach($scope.assocAddDevices, function(v, k) {
            if (v.id == nodeId) {
                $scope.assocAddInstances = Object.keys(v.endpoints).length > 0 ? v.endpoints : [{key: '0', val: '0'}];
                return;
            }
        });
    };

    //Store assoc device from group
    $scope.storeAssoc = function(input) {
        $scope.toggleRowSpinner('group_' + input.groupCfg.groupId);
        var addDevice = {};
        var endpoints = input.endpoint;
        var clusters = '85';
        var clustersH = 0x85;
        var toInstance = '';
        if (input.toInstance && input.toInstance !== 'plain') {
            clusters = '142';
            clustersH = 0x8e;
            toInstance = ',' + input.toInstance;
        }
        var cmd = 'devices[' + input.nodeId + '].endpoints[' + endpoints + '].clusters[' + clustersH + '].Set(' + input.groupId + ',' + input.toNode + toInstance + ')';
        var data = {
            'id': input.nodeId,
            'endpoint': endpoints,
            'cluster': clusters,
            'command': 'Set',
            'parameter': '[' + input.groupId + ',' + input.toNode + toInstance + ']'

        };
        addDevice[input.toNode] = {
            isNew: true,
            status: 'false-true',
            elId: _.now(),
            id: input.toNode,
            endpoint: parseInt(input.toInstance, 10),
            name: _.findWhere($scope.assocAddDevices, {id: input.toNode}).name
        };
        angular.extend($scope.assocGroupsDevices[endpoints + ':' + input.groupId], addDevice);

        dataService.runZigbeeCmd(cfg.store_url + cmd).then(function(response) {
            $scope.closeAssocModal();
            if(!_.isEmpty($scope.cfgXml)){
                var xmlFile = deviceService.buildCfgXmlAssoc(data,$scope.cfgXml);
                dataService.putCfgXml(xmlFile);
            }
        }, function(error) {
            $window.alert($scope._t('error_handling_data') + '\n' + cmd);
            $scope.loadZigbeeData($routeParams.nodeId);
        });
        $scope.input.toNode = false;
        $scope.input.toInstance = false;
        $scope.input.groupId = 0;
        $scope.assocAddInstances = false;
        return;
    };

    //Delete assoc device from group
    $scope.deleteAssoc = function(d) {
        var params = d.groupId + ',' + d.id;
        if (d.node.cc === '8e') {
            params = d.groupId + ',' + d.id + (d.endpoint > -1 ? ',' + d.endpoint : '');
        }
        var cmd = 'devices[' + d.node.id + '].endpoints[' + d.node.endpoint + '].clusters[0x' + d.node.cc + '].Remove(' + params + ')';
        var data = {
            'id': d.node.id,
            'endpoint': d.node.endpoint,
            'cluster': (d.node.cc === '8e' ? '142' : String(d.node.cc)),
            'command': 'Set',
            'parameter': '[' + params + ']'

        };

            dataService.runZigbeeCmd(cfg.store_url + cmd).then(function(response) {
                if(!_.isEmpty($scope.cfgXml)){
                    var xmlFile = deviceService.deleteCfgXmlAssoc(data, $scope.cfgXml);
                    dataService.putCfgXml(xmlFile);
                }

                $('#' + d.elId).addClass('true-false');

            }, function(error) {
                $window.alert($scope._t('error_handling_data') + '\n' + cmd);
            });
    };

    /// --- Private functions --- ///
    /**
     * Get node endpoints
     */
    function getNodeInstances(node) {
        var endpoints = [];
        if (Object.keys(node.endpoints).length < 2) {
            return endpoints;
        }
        for (var endpointId in node.endpoints) {
            var obj = {};
            obj['key'] = endpointId,
                    obj['val'] = endpointId
            endpoints.push(obj);
        }
        return endpoints;

    }

    /**
     * Set zigbee data
     */
    function setData(node, ZigbeeAPIData, nodeId, cfgXml) {
        var zddXmlFile = $filter('hasNode')(node, 'data.ZDDXMLFile.value');
        //  zddXmlFile not available
        if (!zddXmlFile || zddXmlFile === 'undefined') {
            $scope.assocGroups = getAssocGroups(node, null, nodeId, ZigbeeAPIData, cfgXml);
            if ($scope.assocGroups.length < 1) {
                $scope.alert = {message: $scope._t('no_association_groups_found'), status: 'alert-warning', icon: 'fa-exclamation-circle'};
            }
            return;
        }

        dataService.xmlToJson(cfg.server_url + cfg.zddx_url + zddXmlFile).then(function (zddXmlData) {
            var zdd = $filter('hasNode')(zddXmlData, 'ZigbeeDevice.assocGroups');
            $scope.assocGroups = getAssocGroups(node, zdd, nodeId, ZigbeeAPIData, cfgXml);
            if ($scope.assocGroups.length < 1) {
                $scope.alert = {message: $scope._t('no_association_groups_found'), status: 'alert-warning', icon: 'fa-exclamation-circle'};
            }
        });

    }

    /**
     * Get assoc groups
     */
    function getAssocGroups(node, zdd, nodeId, ZigbeeAPIData, cfgXml) {
        var assocGroups = [];
        var groupZdd = [];
        if (zdd) {
            angular.forEach(zdd, function(zddval, zddkey) {
                if (angular.isArray(zddval)) {
                    angular.forEach(zddval, function(val, key) {
                        groupZdd[val._number] = val;
                    });
                } else {
                    groupZdd[zddval._number] = zddval;
                }
            });
        }
        $scope.nodeCfg.notAwake = [];

        angular.forEach(node.endpoints, function(endpoint, index) {

            if (!("clusters" in endpoint)) {
                return;
            }

            if (0x85 in endpoint.clusters || 0x8e in endpoint.clusters) {
                var groups = 0;
                if (0x85 in endpoint.clusters) {
                    groups = endpoint.clusters[0x85].data.groups.value;

                }

                if (0x8e in endpoint.clusters) {
                    if (endpoint.clusters[0x8e].data.groups.value > groups) {
                        groups = endpoint.clusters[0x8e].data.groups.value;
                    }

                }
                for (var group = 0; group < groups; group++) {
                    var data;
                    var dataMca;
                    var assocDevices = [];
                    var cfgArray;
                    var cfgArrayMca;
                    var groupCfg = [];
                    var groupDevices = [];
                    var savedInDevice = [];
                    var nodeIds = [];
                    var endpointIds = [];
                    var persistent = [];
                    var updateTime;
                    var invalidateTime;
                    var updateTimeMca;
                    var invalidateTimeMca;
                    var groupId;
                    var label;
                    var max;
                    var timeClass = 'undef';
                    var obj = {};


                    groupId = (group + 1);
                    label = getGroupLabel(groupZdd[groupId], group, endpoint);
                    max = $filter('hasNode')(groupZdd[groupId], '_maxNodes');
                    //console.log(groupId,group)
                    $scope.assocGroupsDevices[index + ':' + groupId] = {};
                    /**
                     * Plain assoc
                     */
                    if ((0x85 in endpoint.clusters) && (group < endpoint.clusters[0x85].data.groups.value)) {
                        cfgArray = deviceService.getCfgXmlAssoc(cfgXml, nodeId, '0', '85', 'Set', groupId);
                        var savedNodesInDevice = [];
                        data = endpoint.clusters[0x85].data[groupId];

                        // Find duplicates in nodes
                        for (var i = 0; i < data.nodes.value.length; i++) {
                            if (savedNodesInDevice.indexOf(data.nodes.value[i]) === -1) {
                                savedNodesInDevice.push(data.nodes.value[i]);
                            }
                            /*if ((data.nodes.value.lastIndexOf(data.nodes.value[i]) != i) && (savedNodesInDevice.indexOf(data.nodes.value[i]) == -1)) {
                             savedNodesInDevice.push(data.nodes.value[i]);
                             }*/
                        }

                        groupDevices = data.nodes.value;
                        updateTime = data.nodes.updateTime;
                        invalidateTime = data.nodes.invalidateTime;
                        if (cfgArray[groupId] && cfgArray[groupId].nodes.length > 0) {
                            groupCfg = cfgArray[groupId].nodes;
                            $.merge(groupDevices, groupCfg);
                        }


                        for (var i = 0; i < $filter('unique')(groupDevices).length; i++) {

                            var targetNodeId = data.nodes.value[i];
                            var targetNode = ZigbeeAPIData.devices[targetNodeId];
                            nodeIds.push(targetNodeId);
                            var targetInstanceId = 0;
                            endpointIds.push(targetInstanceId);

                            var toCfgXml = {
                                'id': String($scope.nodeCfg.id),
                                'endpoint': String($scope.nodeCfg.endpoint),
                                'cluster': '85',
                                'command': 'Set',
                                'parameter': '[' + groupId + ',' + targetNodeId + ']'

                            };

                            var inConfig = deviceService.isInCfgXml(toCfgXml, cfgXml);
                            var objAssoc = {};
                            objAssoc['id'] = targetNodeId;
                            objAssoc['deviceExcluded'] = (!targetNode);
                            objAssoc['isNew'] = false;
                            objAssoc['groupId'] = groupId;
                            objAssoc['elId'] = groupId + '_' + targetNodeId + '_' + 'A' + '_' + i;
                            objAssoc['name'] = $filter('deviceName')(targetNodeId, targetNode);
                            objAssoc['endpoint'] = targetInstanceId;
                            objAssoc['cc'] = '85';
                            objAssoc['node'] = {
                                id: nodeId,
                                endpoint: index,
                                cc: '85'
                            };
                            // objAssoc['inDevice'] =  savedNodesInDevice.indexOf(targetNodeId) > -1 ? true : false;
                            // objAssoc['inConfig'] = inConfig;
                            objAssoc['status'] = (savedNodesInDevice.indexOf(targetNodeId) > -1 ? true : false) + '-' + inConfig;
                            assocDevices.push(objAssoc);
                            $scope.assocGroupsDevices[index + ':' + groupId][targetNodeId] = objAssoc;
                        }
                    }
                    /**
                     * Multichannel assoc
                     */
                    if ((0x8e in endpoint.clusters) && (group < endpoint.clusters[0x8e].data.groups.value)) {
                        cfgArrayMca = deviceService.getCfgXmlAssoc(cfgXml, nodeId, '0', '142', 'Set', groupId);
                        var savedNodesInstancesInDevice = [];
                        dataMca = endpoint.clusters[0x8e].data[group + 1];
                        for (var i = 0; i < Object.keys(dataMca.nodesInstances.value).length; i += 2) {
                            savedNodesInstancesInDevice.push(dataMca.nodesInstances.value[i] + '_' + dataMca.nodesInstances.value[i + 1]);
                        }
                        updateTimeMca = dataMca.nodesInstances.updateTime;
                        invalidateTimeMca = dataMca.nodesInstances.invalidateTime;
                        if (cfgArrayMca[groupId] && cfgArrayMca[groupId].nodeInstances.length > 0) {
                            angular.forEach(cfgArrayMca[groupId].nodeInstances, function(vMca) {
                                if (savedNodesInstancesInDevice.indexOf(vMca) === -1) {
                                    var slice = vMca.split('_');
                                    dataMca.nodesInstances.value.push(parseInt(slice[0], 10));
                                    dataMca.nodesInstances.value.push(parseInt(slice[1], 10));
                                }
                            });
                        }
                        for (var i = 0; i < Object.keys(dataMca.nodesInstances.value).length; i += 2) {
                            var targetNodeId = dataMca.nodesInstances.value[i];
                            var targetNode= ZigbeeAPIData.devices[targetNodeId];
                            nodeIds.push(targetNodeId);
                            var targetInstanceId = dataMca.nodesInstances.value[i + 1];
                            endpointIds.push(targetInstanceId);
                            var idNodeInstance = dataMca.nodesInstances.value[i] + '_' + dataMca.nodesInstances.value[i + 1];
                            var toCfgXml = {
                                'id': String($scope.nodeCfg.id),
                                'endpoint': String($scope.nodeCfg.endpoint),
                                'cluster': '142',
                                'command': 'Set',
                                'parameter': '[' + groupId + ',' + targetNodeId + ',' + targetInstanceId + ']'

                            };
                            var inConfig = deviceService.isInCfgXml(toCfgXml, cfgXml);
                            var objAssoc = {};
                            objAssoc['id'] = targetNodeId;
                            objAssoc['deviceExcluded'] = (!targetNode);
                            objAssoc['isNew'] = false;
                            objAssoc['groupId'] = groupId;
                            objAssoc['elId'] = groupId + '_' + targetNodeId + '_' + targetInstanceId + '_' + i;
                            objAssoc['name'] = $filter('deviceName')(targetNodeId, targetNode);
                            objAssoc['endpoint'] = targetInstanceId;
                            objAssoc['cc'] = '8e';
                            objAssoc['node'] = {
                                id: nodeId,
                                endpoint: index,
                                cc: '8e'
                            };
                            //objAssoc['inDevice'] = savedNodesInstancesInDevice.indexOf(idNodeInstance) > -1 ? true : false;
                            //objAssoc['inConfig'] = inConfig;
                            objAssoc['status'] = (savedNodesInstancesInDevice.indexOf(idNodeInstance) > -1 ? true : false) + '-' + inConfig;
                            assocDevices.push(objAssoc);

                            $scope.assocGroupsDevices[index + ':' + groupId][String(targetNodeId) + String(i)] = objAssoc;
                        }
                    }


                    if ((updateTime < invalidateTime) || (updateTimeMca < invalidateTimeMca)) {
                        timeClass = 'red';
                        $scope.nodeCfg.isAwake = true;
                        if ($scope.nodeCfg.notAwake.indexOf(groupId) === -1) {
                            $scope.nodeCfg.notAwake.push(groupId);
                        }

                    }

                    obj = {
                        label: label,
                        devices: assocDevices,
                        nodeId: nodeId,
                        endpoint: index,
                        groupId: groupId,
                        nodeIds: $filter('unique')(nodeIds),
                        endpointIds: endpointIds,
                        persistent: persistent,
                        max: max || data.max.value,
                        updateTime: updateTime,
                        invalidateTime: invalidateTime,
                        timeClass: timeClass,
                        remaining: (data.max.value - $filter('unique')(nodeIds).length)
                    };
                    assocGroups.push(obj);

                }
            }

        });
        return assocGroups;
    }

    /**
     * Get group name
     */
    function getGroupLabel(assocGroups, index, endpoint) {
        // Set default assoc group name
        var label = $scope._t('association_group') + " " + (index + 1);

        // Attempt to get assoc group name from the zdd file
        var langs = $filter('hasNode')(assocGroups, 'description.lang');
        if (langs) {
            if (angular.isArray(langs)) {
                for (var i = 0, len = langs.length; i < len; i++) {
                    if (("__text" in langs[i]) && (langs[i]["_xml:lang"] == $scope.lang)) {
                        label = langs[i].__text;
                        continue;
                        //return label;

                        //continue;
                    } else {
                        if (("__text" in langs[i]) && (langs[i]["_xml:lang"] == 'en')) {
                            label = langs[i].__text;
                            continue;
                            //return label;
                        }
                    }
                }
            } else {
                if (("__text" in langs)) {
                    label = langs.__text;
                }
            }
        } else {
            // Attempt to get assoc group name from the command class
            angular.forEach(endpoint.clusters, function(v, k) {
                if (v.name == 'AssociationGroupInformation') {
                    label = $filter('hasNode')(v, 'data.' + (index + 1) + '.groupName.value');
                }

            });
        }
        return label;
    }
    ;

});
