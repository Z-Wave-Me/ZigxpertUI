/**
 * @overview Used to report alarm events from binary sensors.
 * @author Martin Vach
 */

/**
 * Notificationr root controller
 * @class NotificationController
 *
 */
appController.controller('NotificationController', function ($scope, $filter, $timeout, $interval, dataService, cfg, deviceService, $cookies, $route, _) {
    $scope.notifications = {
        all: [],
        interval: null,
        show: false
    };
    $scope.notificationsExpand = $cookies.notificationsExpand !== 'collapsed';
    /**
     * Cancel interval on page destroy
     */
    $scope.$on('$destroy', function () {
        $interval.cancel($scope.notifications.interval);
    });
    /**
     * Load Alarms.xml
     */
    $scope.loadXmlData = function () {
        dataService.xmlToJson(cfg.server_url + cfg.alarms_url).then(function (response) {
            $scope.loadZigbeeData(response.Alarms.Alarm);
        }, function (error) {
            alertify.alertError($scope._t('error_load_data'));
        });
    };
    $scope.loadXmlData();

    /**
     * Load zigbee data
     */
    $scope.loadZigbeeData = function (alarms) {
        dataService.loadZigbeeApiData().then(function (ZigbeeAPIData) {
            setData(ZigbeeAPIData, alarms);
            if (_.isEmpty($scope.notifications.all)) {
                $scope.alert = {
                    message: $scope._t('device_404'),
                    status: 'alert-warning',
                    icon: 'fa-exclamation-circle'
                };
                return;
            }
            $scope.notifications.show = true;
            $scope.refreshZigbeeData(alarms);
        }, function (error) {
            alertify.alertError($scope._t('error_load_data'));
        });
    };
    // $scope.loadZigbeeData();


    /**
     * Refresh zigbee data
     * @param {object}  alarms
     */
    $scope.refreshZigbeeData = function (alarms) {
        var refresh = function () {
            dataService.loadJoinedZigbeeData().then(function (response) {
                setData(response.data.joined, alarms);
            });
        };
        $scope.notifications.interval = $interval(refresh, $scope.cfg.interval);
    };

    /**
     * Set status
     * @param {string} url
     */
    $scope.setStatus = function (url) {
        $scope.runZigbeeCmd(url);
    };

    /**
     * Update notification
     * @param {string} url
     */
    $scope.updateNotification = function (url) {
        $scope.runZigbeeCmd(url);
    };

    /**
     * Update all notifications
     * @param {string} id
     * @param {string} urlType
     */
    $scope.updateAllNotifications = function (id, urlType) {
        var lastItem = _.last($scope.notifications.all);
        $scope.toggleRowSpinner(id);
        angular.forEach($scope.notifications.all, function (v, k) {
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

    /// --- Private functions --- ///

    /**
     * Set zigbee data
     * @param {object} ZigbeeAPIData
     * @param alarms
     */
    function setData(ZigbeeAPIData, alarms) {
        $scope.controllerId = ZigbeeAPIData.controller.data.nodeId.value;
        // console.log(ZigbeeAPIData, alarms);
        // Loop throught devices
        angular.forEach(ZigbeeAPIData.devices, function (node, nodeId) {
            if (nodeId == $scope.controllerId) {
                return false;
            }
            var allInterviewsDone = deviceService.allInterviewsDone(node.endpoints);
            if(!allInterviewsDone){
                return;
            }
            //console.log(allInterviewsDone)
            // Loop throught endpoints
            angular.forEach(node.endpoints, function (endpoint, endpointId) {
                if (endpointId == 0 && node.endpoints.length > 1) {
                    return;
                }

                // Look for Notifications - Loop throught 0x71/113 clusters
                var hasNotification = endpoint.clusters[0x71];
                if (!angular.isObject(hasNotification)) {
                    return;
                }
                var version = parseInt(hasNotification.data.version.value, 10);

                var obj = {};
                obj['id'] = parseInt(nodeId, 10);
                obj['rowId'] = hasNotification.name + '_' + nodeId + '_' + endpointId + '_' + '113' + '_';
                obj['endpointId'] = endpointId;
                obj['name'] = $filter('deviceName')(nodeId, node);
                obj['version'] = version;
                // if (version > 1) {
                    notificationV2(obj, hasNotification.data);
                // } else {
                //     notificationV1(obj, hasNotification.data);
                // }
            });
        });
    }

    /**
     * Set notifications version 1
     * @param node
     * @param {object} data
     */
    function notificationV1(node, data) {
        var typeId = parseInt(data.V1event.alarmType.value, 10);
        if (isNaN(typeId)) {
            return;
        }
        var obj = {};
        obj['id'] = node.id;
        obj['idSort'] = $filter('zeroFill')(node.id);
        obj['rowId'] = node.rowId + typeId;
        obj['endpointId'] = node.endpointId;
        obj['name'] = node.name;
        obj['version'] = node.version;
        obj['typeId'] = typeId;
        obj['typeString'] = typeId;
        obj['event'] = data.V1event.level.value;
        obj['eventString'] = data.V1event.level.value;
        obj['status'] = 0;
        obj['statusString'] = '-';
        obj['invalidateTime'] = data.V1event.alarmType.invalidateTime;
        obj['updateTime'] = data.V1event.alarmType.updateTime;
        obj['isUpdated'] = obj['updateTime'] > obj['invalidateTime'];
        obj['dateTime'] = $filter('getDateTimeObj')(data.V1event.alarmType.updateTime,obj['updateTime']);
        obj['urlToStore'] = 'devices[' + obj['id'] + '].endpoints[' + obj['endpointId'] + '].clusters[113].Get(' + typeId + ')';
        //console.log(obj)
        var findIndex = _.findIndex($scope.notifications.all, {rowId: obj.rowId});
        if (findIndex > -1) {
            angular.extend($scope.notifications.all[findIndex], obj);

        } else {
            $scope.notifications.all.push(obj);
        }
    }


    function notificationV2Converter({
                                         typeId,
                                         typeString,
                                         enableAlarms,
                                         children,
                                         isUpdated,
      dateTime
                                     }, node) {
        const obj = {
            id: node.id,
            idSort: $filter('zeroFill')(node.id),
            rowId: node.rowId + typeId,
            endpointId: node.endpointId,
            name: node.name,
            version: node.version,
            typeId,
            children,
            isUpdated,
            dateTime,
            lastTriggeredEvent: children.filter(({status}) => status).reduce((prev, curr) => prev.updateTime > curr.updateTime ? prev : curr, {}),
            typeString,
            status: enableAlarms,
            urlToOn: 'devices[' + node.id + '].endpoints[' + node.endpointId + '].clusters[113].Set(' + typeId + ',255)',
            urlToOff: 'devices[' + node.id + '].endpoints[' + node.endpointId + '].clusters[113].Set(' + typeId + ',0)',
            urlToStore: 'devices[' + node.id + '].endpoints[' + node.endpointId + '].clusters[113].Get(' + typeId + ')'
        };
        const findIndex = _.findIndex($scope.notifications.all, {rowId: obj.rowId});
        if (findIndex > -1) {
            angular.extend($scope.notifications.all[findIndex], obj);

        } else {
            $scope.notifications.all.push(obj);
        }
    }

    /**
     * Set notifications version 2
     * @param node
     * @param {object} data
     * @param alarms
     */
    function notificationV2(node, data) {
        Object.entries(data).filter(([key]) => !isNaN(+key)).map(([typeId, value]) => {
            const {typeString: {value: typeString}, status: {value: enableAlarms}, updateTime, invalidateTime} = value;
            // TODO no more needed 26.09.2022
            // const typeHex = $filter('decToHex')(typeId, 2, '0x');
            // const eventHex = $filter('decToHex')(eventId, 2, '0x');
            // const alarm = _.findWhere(alarms, {_id: typeHex});
            // if (alarm) {
            //     typeString = deviceService.configGetZddxLang(alarm.name.lang, $scope.lang);
            //     const event = _.findWhere(alarm.Event, {_id: eventHex});
            //     if (event) {
            //         eventString = deviceService.configGetZddxLang(event.name.lang, $scope.lang);
            //     }
            // }
            // console.log(typeId, eventId, status);
            return {
                typeId,
                typeString,
                enableAlarms,
                isUpdated: updateTime > invalidateTime,
                dateTime: $filter('getDateTimeObj')(updateTime, invalidateTime),
                children: Object.entries(value).filter(([key]) => !isNaN(+key))
                  .map(([eventId, {
                      eventString: {value: eventString},
                      status: {updateTime, invalidateTime, value: status},
                      isState: {value: isState}
                  }]) => ({
                      eventId,
                      eventString,
                      status,
                      updateTime,
                      isState,
                      isUpdated: updateTime > invalidateTime,
                      dateTime: $filter('getDateTimeObj')(updateTime, invalidateTime),
                  })),
            }
        })
          .map((data) => notificationV2Converter(data, node));
    }
    $scope.toggleDefault = function () {
        $cookies.notificationsExpand = $cookies.notificationsExpand === 'expanded' ? 'collapsed' : 'expanded';
        $route.reload();
    }
});
