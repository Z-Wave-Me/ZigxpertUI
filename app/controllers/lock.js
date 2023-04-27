/**
 * @overview This controller renders and handles locks.
 * @author Martin Vach
 */

/**
 * Lock root controller
 * @class LocksController
 *
 */
appController.controller('LocksController', function($scope, $filter, $timeout,$interval,dataService, cfg,_) {
    $scope.locks = {
        ids: [],
        all: [],
        interval: null,
        show: false
    };

    /**
     * Cancel interval on page destroy
     */
    $scope.$on('$destroy', function() {
        $interval.cancel($scope.locks.interval);
    });

    /**
     * Load zigbee data
     */
    $scope.loadZigbeeData = function() {
        dataService.loadZigbeeApiData().then(function(ZigbeeAPIData) {
            setData(ZigbeeAPIData);
            if(_.isEmpty($scope.locks.all)){
                $scope.alert = {message: $scope._t('device_404'), status: 'alert-warning', icon: 'fa-exclamation-circle'};
                return;
            }
            $scope.locks.show = true;
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
                    if( $scope.locks.ids.indexOf(findId) > -1){
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
        $scope.locks.interval = $interval(refresh, $scope.cfg.interval);
    };

    /**
     * Update lock
     * @param {string} url
     */
    $scope.updateLock = function(url) {
        $scope.toggleRowSpinner(url);
        dataService.runZigbeeCmd(cfg.store_url + url).then(function (response) {
            $timeout($scope.toggleRowSpinner, 1000);
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
        var controllerNodeId = ZigbeeAPIData.controller.data.nodeId.value;
        var doorLockCCId = 0x62;
        // Loop throught devices
        angular.forEach(ZigbeeAPIData.devices, function(node, nodeId) {
            if (nodeId == controllerNodeId) {
                return;
            }

            // Loop throught endpoints
            var cnt = 1;
            angular.forEach(node.endpoints, function(endpoint, endpointId) {
                // we don't want devices without DoorLock CC
                if (!(doorLockCCId in endpoint.clusters)) {
                    return;
                }

                // CC gui
                var mode = endpoint.clusters[doorLockCCId].data.mode.value;

                var ccId = 98;
                // Set object
                var obj = {};
                //var level = $scope.updateLevel(endpoint.clusters[ccId].data.level, ccId);
                var apiUrl = 'devices[' + nodeId + '].endpoints[' + endpointId + '].clusters[' + ccId + ']';

                obj['id'] = nodeId;
                obj['iId'] = endpointId;
                obj['idSort'] = $filter('zeroFill')(nodeId);
                obj['cmd'] = 'devices.' + nodeId + '.endpoints.' + endpointId + '.clusters.' + ccId + '.data.mode';
                obj['ccId'] = doorLockCCId;
                obj['rowId'] = 'row_' + nodeId + '_' + cnt;
                obj['name'] = $filter('deviceName')(nodeId, node);
                obj['status'] = $filter('lockStatus')(mode);
                obj['level'] = mode;
                obj['updateTime'] = endpoint.clusters[ccId].data.mode.updateTime;
                obj['invalidateTime'] = endpoint.clusters[ccId].data.mode.invalidateTime;
                obj['dateTime'] = $filter('getDateTimeObj')(obj['updateTime'],obj['invalidateTime']);
                obj['isUpdated'] = ((obj['updateTime'] > obj['invalidateTime']) ? true : false);
                obj['urlToStore'] = apiUrl + '.Get()';
                obj['urlToOff'] =  apiUrl + '.Set(0)';
                obj['urlToOn'] =  apiUrl + '.Set(255)';
                obj['cmdToUpdate'] = 'devices.' + nodeId + '.endpoints.' + endpointId + '.clusters.' + ccId + '.data.mode';
                var findIndex = _.findIndex($scope.locks.all, {rowId: obj.rowId});
                if(findIndex > -1){
                    angular.extend($scope.locks.all[findIndex],obj);

                }else{
                    $scope.locks.all.push(obj);
                }
                if($scope.locks.ids.indexOf(nodeId) === -1){
                    $scope.locks.ids.push(nodeId);
                }
                cnt++;
            });
        });
    }
});