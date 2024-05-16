/**
 * @overview This is used to control the Zigbee controller itself and ot manage the Zigbee network.
 * @author Martin Vach
 */

/**
 * Control root ontroller
 * @class ControlController
 *
 */
appController.controller('ControlController', function ($scope, $interval, $timeout, $filter, $window, cfg, dataService, deviceService) {
    $scope.controlDh = {
        process: false,
        interval: null,
        includeToNetworkTimeout: null,
        show: false,
        alert: $scope.alert,
        qrcodeVersion: 2,
        controller: {},
        limitReached: false,
        inclusion: {
            lastIncludedDevice: $scope.alert,
            lastExcludedDevice: $scope.alert,
            lastIncludedDeviceId: 0,
            securityAbandoned: false,
            secureChannelEstablished: false,
            alert: $scope.alert,
            alertPrimary: $scope.alert,
            alertS2: $scope.alert,
            popup: false,
        },
        network: {
            include: false,
            inclusionProcess: false,
            alert: $scope.alert,
            modal: false
        },
        nodes: {
            all: [],
            failedNodes: [],
            failedBatteries: [],
            sucSis: []

        },
        input: {
            failedNode: 0,
            removeNode: 0,
            failedBatteries: 0,
            sucSis: 0
        },
        removed: {
            failedNodes: [],
            removedNodes: [],
            failedBatteries: []
        },
        factory: {
            process: false,
            alert: $scope.alert,
        }
    };
    /**
     * Cancel interval on page destroy
     */
    $scope.$on('$destroy', function () {
        $interval.cancel($scope.controlDh.interval);
    });

    $scope.wordBlock = function (val) {
        return ('00000' + val.toString(10)).substr(-5);
    };
    
    $scope.qrChecksum = function(str) {
        var sha = sha1.array(str);

        return $scope.wordBlock(sha[0] * 256 + sha[1]);
    };
    
    /**
     * Get block of DSK
     */
    $scope.dskBlock = function (publicKey, block) {
        if (!publicKey) {
            return '';
        }
        return $scope.wordBlock(publicKey[(block - 1) * 2] * 256 + publicKey[(block - 1) * 2 + 1]);
    };
    

    /**
     * Load zigbee data
     */
    $scope.loadZigbeeData = function () {
        dataService.loadZigbeeApiData().then(function (ZigbeeAPIData) {
            setControllerData(ZigbeeAPIData);
            setDeviceData(ZigbeeAPIData);
            $scope.controlDh.show = true;
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
                setControllerData(response.data.joined);
                setDeviceData(response.data.joined);
                setInclusionData(response.data.joined, response.data.update);
                if ($scope.controlDh.inclusion.lastIncludedDeviceId != 0) {
                    console.log('Waiting 5 seconds and than check interview')
                    var nodeInstances = $filter('hasNode')(response, 'data.joined.devices.' + $scope.controlDh.inclusion.lastIncludedDeviceId + '.endpoints');
                    $timeout(function () {
                        checkInterview(nodeInstances);
                    }, 5000);
                }
            });
        };
        $scope.controlDh.interval = $interval(refresh, $scope.cfg.interval);
    };

    /// --- Private functions --- ///
    /**
     * Set controller data
     * @param {object} ZigbeeAPIData
     */
    function setControllerData(ZigbeeAPIData) {
        var nodeId = ZigbeeAPIData.controller.data.nodeId.value;
        var hasDevices = Object.keys(ZigbeeAPIData.devices).length;
        var controllerState = ZigbeeAPIData.controller.data.controllerState.value;
        
        /*
        var manufacturerId = $filter('hasNode')(ZigbeeAPIData,'devices.' + nodeId + '.data.radioManufacturer.value');
        var productId = $filter('hasNode')(ZigbeeAPIData,'devices.' + nodeId + '.data.radioBoardName.value');
        var appVersionMajor = $filter('hasNode')(ZigbeeAPIData,'devices.' + nodeId + '.data.EmberZNetVersionMajor.value');
        var appVersionMinor = $filter('hasNode')(ZigbeeAPIData,'devices.' + nodeId + '.data.EmberZNetVersionMinor.value');
        */
        
        // Customsettings
        $scope.controlDh.controller.hasDevices = hasDevices > 1;

        // Default controller settings
        $scope.controlDh.controller.nodeId = nodeId;
        $scope.controlDh.controller.controllerState = controllerState;

        $scope.controlDh.inclusion.alert = {
            message: $scope._t('nm_controller_state_' + controllerState),
            status: 'alert-warning',
            icon: 'fa-spinner fa-spin'
        };

        if ([1, 5].indexOf(controllerState) == -1) {
            if ($scope.controlDh.includeToNetworkTimeout) {
                $timeout.cancel($scope.controlDh.includeToNetworkTimeout);
                $scope.controlDh.network.modal = true;
            }
        }

      

        // Controller state switch
        switch (controllerState) {
            case 0:
                // Device inclusion
                $scope.controlDh.inclusion.alert = {
                    message: $scope._t('nm_controller_state_' + controllerState),
                    status: 'alert-info',
                    icon: false
                };
                $scope.controlDh.inclusion.alertPrimary = $scope.alert;
                // Network inclusion
                if ($scope.controlDh.network.inclusionProcess) {
                    if ($scope.controlDh.network.include) {
                        if (!$scope.controlDh.network.modal) {
                            $scope.controlDh.network.alert = {
                                message: $scope._t('nm_controller_state_10'),
                                status: 'alert-warning',
                                icon: 'fa-spinner fa-spin'
                            };
                            $scope.controlDh.network.inclusionProcess = 'processing';
                        } else {
                            $scope.controlDh.network.alert = {
                                message: $scope._t('success_controller_include'),
                                status: 'alert-success',
                                icon: 'fa-smile'
                            };
                            $scope.controlDh.network.inclusionProcess = false;
                            if ($scope.controlDh.controller.isRealPrimary || !$scope.controlDh.controller.isInOthersNetwork) {
                                // Reloading a page
                                $timeout(function () {
                                    $window.location.reload();
                                }, 3000);
                            }

                        }
                    }

                } else {
                    $scope.controlDh.network.alert = $scope.alert;
                }
                // Factory default
                if ($scope.controlDh.factory.process) {
                    $scope.toggleRowSpinner('controller.SetDefault()');
                    $scope.controlDh.factory.process = false;
                    $scope.controlDh.factory.alert = {
                        message: $scope._t('reloading'),
                        status: 'alert-warning',
                        icon: 'fa-spinner fa-spin'
                    };
                    // Reloading a page
                    $timeout(function () {
                        $window.location.reload();
                    }, 3000);
                }
                break;
            case 1:
                // Device inclusion
                break;
            /*
            case 9:
                // Network inclusion
                $scope.controlDh.network.inclusionProcess = 'processing';
                $scope.controlDh.network.alert = {
                    message: $scope._t('nm_controller_state_11'),
                    status: 'alert-warning',
                    icon: 'fa-spinner fa-spin'
                };
                break;
            case 17:
                // Network inclusion
                $scope.controlDh.network.alert = {
                    message: $scope._t('nm_controller_state_17'),
                    status: 'alert-danger',
                    icon: 'fa-exclamation-triangle'
                };
                $scope.controlDh.network.inclusionProcess = 'error';
                break;
            case 20:
                // Factory default
                $scope.controlDh.factory.process = true;
                $scope.controlDh.factory.alert = {
                    message: $scope._t('nm_controller_state_20'),
                    status: 'alert-success',
                    icon: 'fa-smile'
                };
                break;
            */
            default:
                break;
        }
    }

    /**
     * Set device data
     * @param {object} ZigbeeAPIData
     */
    function setDeviceData(ZigbeeAPIData) {
        angular.forEach(ZigbeeAPIData.devices, function (node, nodeId) {
            if (nodeId == ZigbeeAPIData.controller.data.nodeId.value) {
                return;
            }
            // Devices
            if ($scope.controlDh.nodes.all.indexOf(nodeId) === -1) {
                $scope.controlDh.nodes.all.push(nodeId);
            }
            if (node.data.isFailed.value) {
                if ($scope.controlDh.nodes.failedNodes.indexOf(nodeId) === -1) {
                    $scope.controlDh.nodes.failedNodes.push(nodeId);
                }
            }
            if (node.data.isSleepy.value && !node.data.isFailed.value) {
                if ($scope.controlDh.nodes.failedBatteries.indexOf(nodeId) === -1) {
                    $scope.controlDh.nodes.failedBatteries.push(nodeId);
                }
            }
        });
    }

    /**
     * Set inclusion data
     * @param {object} data
     */
    function setInclusionData(data, update) {
        var deviceIncId = null, deviceExcId = null;
        if ('controller.data.lastIncludedDevice' in update) {
            deviceIncId = update['controller.data.lastIncludedDevice'].value;
        }
        if ('controller.data.lastExcludedDevice' in update) {
            deviceExcId = update['controller.data.lastExcludedDevice'].value;
        }
        if (deviceIncId === null && deviceExcId === null) {
            return;
        }
        /**
         * Last icluded device
         */

        if (deviceIncId !== null) {
            var node = data.devices[deviceIncId];
            var givenName = $filter('deviceName')(deviceIncId, node);
            var updateTime = $filter('isTodayFromUnix')(data.controller.data.lastIncludedDevice.updateTime);
            /*
            // givenName set is not done in HA
            if(!node.data.givenName.value || node.data.givenName.value == ''){
              var cmd = 'devices[' + deviceIncId + '].data.givenName.value=\'' + givenName + '\'';
              dataService.runZigbeeCmd(cfg.store_url + cmd);
            }
            */
           
            $scope.controlDh.inclusion.lastIncludedDeviceId = deviceIncId;
            $scope.controlDh.inclusion.lastIncludedDevice = {
                message: $scope._t('nm_last_included_device') + '  (' + updateTime + ')  <a href="#configuration/interview/' + deviceIncId + '"><strong>' + givenName + '</strong></a>',
                status: 'alert-success',
                icon: 'fa-smile'
            };
        }

        /**
         * Last excluded device
         */
        if (deviceExcId !== null) { // 0 is valid and means excluded from foreign
            var updateTime = $filter('isTodayFromUnix')(data.controller.data.lastExcludedDevice.updateTime);
            if (deviceExcId != 0) {
                var txt = $scope._t('txt_device') + ' # ' + deviceExcId + ' ' + $scope._t('nm_excluded_from_network');
            } else {
                var txt = $scope._t('nm_last_excluded_device_from_foreign_network');
            }

            //$scope.controlDh.inclusion.lastExcludedDevice = txt + ' (' + updateTime + ')';
            $scope.controlDh.inclusion.lastExcludedDevice = {
                message: txt + ' (' + updateTime + ')',
                status: 'alert-success',
                icon: 'fa-smile'
            };
        }
    }

    /**
     * Check interview
     */
    function checkInterview(nodeInstances) {
    }
});

/**
 * Shall inclusion be done using Security.
 * @class SetSecureInclusionController
 *
 */
appController.controller('SetSecureInclusionController', function ($scope) {
    /**
     * Set inclusion as Secure/Unsecure.
     * state=true Set as secure.
     * state=false Set as unsecure.
     * @param {string} cmd
     */
    $scope.setSecureInclusion = function (cmd) {
        $scope.runZigbeeCmd(cmd);
    };
});

/**
 * Shall inclusion be done using Long Range
 * @class SetLongRangeInclusionController
 *
 */
appController.controller('SetLongRangeInclusionController', function ($scope) {
    /**
     * Set inclusion as Classic/Long Range.
     * state=true Set as Long Range.
     * state=false Set as Classic.
     * @param {string} cmd
     */
    $scope.setLongRangeInclusion = function (cmd) {
        $scope.runZigbeeCmd(cmd);
    };
});

/**
 * This turns the Zigbee controller into an inclusion/exclusion mode that allows including/excluding a device.
 * @class IncludeDeviceController
 *
 */
appController.controller('IncludeExcludeDeviceController', function ($scope, $route) {
    /**
     * Start Inclusion of a new node.
     * Turns the controller into an inclusion mode that allows including a device.
     * flag=1 for starting the inclusion mode
     * flag=0 for stopping the inclusion mode
     * @param {number} flag
     */
    $scope.addNodeToNetwork = function (flag) {
        // $scope.controlDh.inclusion.lastIncludedDeviceId = 0;
        $scope.runZigbeeCmd('controller.AddNodeToNetwork(' + flag + ')');
        $route.reload();
    };

    /**
     * Stop Exclusion of a node.
     * Turns the controller into an exclusion mode that allows excluding a device.
     * flag=1 for starting the exclusion mode
     * flag=0 for stopping the exclusion mode
     * @param {string} cmd
     */
    $scope.removeNodeToNetwork = function (cmd) {
        //$scope.controlDh.inclusion.lastExcludedDevice = false;
        $scope.runZigbeeCmd(cmd);
        $route.reload();
    };
});

/**
 * It will change Zigbee controller own Home ID to the Home ID of the new network
 * and it will learn all network information from the including controller of the new network.
 * All existing relationships to existing nodes will get lost
 * when the Z-Way controller joins a different network
 * @class IncludeDifferentNetworkController
 *
 */
appController.controller('IncludeDifferentNetworkController', function ($scope, $timeout, $window, cfg, dataService) {
    /**
     * Include to network
     * @param {string} cmd
     * @param {string} confirm
     */
    $scope.includeToNetwork = function (cmd, confirm) {
        if (_.isString(confirm)) {// Confirm is needed
            alertify.confirm(confirm, function () {
                $scope.runIncludeToNetwork(cmd);
            });
        } else {
            $scope.runIncludeToNetwork(cmd);
        }


    };

    /**
     * Process network inclusion
     * @param {string} cmd
     */
    $scope.runIncludeToNetwork = function (cmd) {
        var timeout = 240000;
        $scope.toggleRowSpinner(cmd);
        if (cmd === 'controller.SetLearnMode(1)') {
            $scope.controlDh.network.include = true;
            $scope.controlDh.network.inclusionProcess = 'processing';
        } else {
            $scope.controlDh.network.include = false;
            $scope.controlDh.network.inclusionProcess = false;
        }
        dataService.runZigbeeCmd(cfg.store_url + cmd).then(function (response) {
            //console.log('Run cmd: ', cfg.store_url + cmd)
            $scope.controlDh.includeToNetworkTimeout = $timeout(function () {
                dataService.runZigbeeCmd(cfg.store_url + 'controller.SetLearnMode(0)');
                $scope.controlDh.network.modal = true;
            }, timeout);
        }, function (error) {
            $scope.toggleRowSpinner();
            alertify.alertError($scope._t('error_load_data') + '\n' + cmd);
        });

    };

    $scope.requestNetworkUpdate = function (cmd, message, id) {
        $scope.controlDh.alert = {
            message: message,
            status: 'alert-info',
            icon: false
        };
        $scope.toggleRowSpinner(id);
        dataService.runZigbeeCmd(cfg.store_url + cmd).then(function () {
            $timeout(function () {
                $scope.controlDh.alert = false;
                $scope.toggleRowSpinner();
            }, 2000);
        }, function () {
            $scope.controlDh.alert = false;
            $scope.toggleRowSpinner();
            alertify.alertError($scope._t('error_load_data'));
        });
    };

    /**
     * Close network modal
     * @param {string} modal
     * @param $event
     */
    $scope.closeNetworkModal = function (modal, $event) {
        $scope.controlDh.network.inclusionProcess = false;
        $scope.controlDh.network.modal = false;
        $window.location.reload();

    };

    /**
     * Set join as Normal/CSA mode.
     * state=true Set as CSA.
     * state=false Set as normal.
     * @param {string} cmd
     */
    $scope.setCSA = function (cmd) {
        $scope.runZigbeeCmd(cmd);
    };

    /// --- Private functions --- ///
});

/**
 * Restore Zigbee controller from the backup
 * @class BackupRestoreController
 *
 */
appController.controller('BackupRestoreController', function ($scope, $upload, $window, $filter, $timeout, deviceService, cfg, _) {
    $scope.restore = {
        allow: false,
        input: {
            restore_chip_info: '0'
        }
    };

    /**
     * Send request to restore from backup
     * todo: Replace $upload vith version from the SmartHome
     * @returns {void}
     */
    $scope.restoreFromBackup = function ($files) {
        var chip = $scope.restore.input.restore_chip_info;
        var url = cfg.server_url + cfg.restore_url + '?restore_chip_info=' + chip;
        var file;
        // Getting a file object
        if ($files.length > 0) {
            file = $files[0];
        } else {
            alertify.alertError($scope._t('restore_backup_failed'));
            return;
        }
        // File extension validation
        if (cfg.upload.restore_from_backup.extension.indexOf($filter('fileExtension')(file.name)) === -1) {
            alertify.alertError(
                    $scope._t('upload_format_unsupported', {'__extension__': $filter('fileExtension')(file.name)}) + ' ' +
                    $scope._t('upload_allowed_formats', {'__extensions__': cfg.upload.restore_from_backup.extension.toString()})
                    );
            return;
        }

        // Uploading file
        $upload.upload({
            url: url,
            fileFormDataName: 'config_backup',
            file: file
        }).progress(function (evt) {
            $scope.loading = {status: 'loading-spin', icon: 'fa-spinner fa-spin', message: $scope._t('restore_wait')};
        }).success(function (data, status, headers, config) {
            $scope.loading = false;
            $scope.handleModal();
            if (data && data.replace(/(<([^>]+)>)/ig, "") !== "null") {//Error
                alertify.alertError($scope._t('restore_backup_failed'));
            } else {// Success
                deviceService.showNotifier({message: $scope._t('restore_done_reload_ui')});
                // Reloading a page
                $timeout(function () {
                    $window.location.reload();
                }, 3000);

            }
        }).error(function (data, status) {
            $scope.loading = false;
            $scope.handleModal();
            alertify.alertError($scope._t('restore_backup_failed'));
        });
    };
});

/**
 * This controller will perform a soft restart and a reset of the Zigbee controller chip.
 * @class ZigbeeChipRebootResetController
 *
 */
appController.controller('ZigbeeChipRebootResetController', function ($scope, cfg, dataService) {
    /**
     * This function will perform a soft restart of the  firmware of the Zigbee controller chip
     * without deleting any network information or setting.
     * @param {string} cmd
     */
    $scope.serialAPISoftReset = function (cmd) {
        $scope.runZigbeeCmd(cmd);
    };

    /**
     * This function erases all values stored in the Zigbee chip and sent the chip back to factory defaults.
     * This means that all network information will be lost without recovery option.
     *  @param {string} cmd
     */
    $scope.setDefault = function (cmd) {
        dataService.runZigbeeCmd(cfg.store_url + cmd).then(function (response) {
            $scope.toggleRowSpinner(cmd);
        }, function (error) {
            $scope.toggleRowSpinner();
            alertify.alertError($scope._t('error_update_data') + '\n' + cmd);
        });
        /* $scope.$watchCollection('controlDh', function (newVal, oldVal) {
         console.log(newVal.controller.controllerState)
         console.log(oldVal.controller.controllerState)
         });*/
        //console.log($scope.controlDh.controller.controllerState)
        // $scope.handleModal('restoreModal');
        //$window.location.reload();
    };
});

/**
 * The controller will then mark the device as 'failed'
 * but will keep it in the current network con guration.
 * @class RemoveFailedNodeController
 *
 */
appController.controller('RemoveFailedNodeController', function ($scope, $timeout) {
    /**
     * Remove failed node from network.
     * nodeId=x Node id of the device to be removed
     * @param {string} cmd
     */
    $scope.removeFailedNode = function (cmd) {
        $scope.runZigbeeCmd(cmd);
        $timeout(function () {
            $scope.controlDh.removed.failedNodes.push($scope.controlDh.input.failedNodes);
            $scope.controlDh.input.failedNodes = 0;
        }, 1000);
    };
});

/**
 * The controller remove a node
 * @class RemoveNodeController
 *
 */
appController.controller('RemoveNodeController', function ($scope, $timeout) {
    /**
     * Remove node
     * nodeId=x Node Id to be removed
     * @param {string} cmd
     */
    $scope.removeNode = function (cmd) {
        $scope.runZigbeeCmd(cmd);
        $timeout(function () {
            $scope.controlDh.removed.removedNodes.push($scope.controlDh.input.removeNode);
            $scope.controlDh.input.removeNode = 0;
        }, 1000);
    };
});

/**
 * Allows marking battery-powered devices as failed.
 * @class BatteryDeviceFailedController
 *
 */
appController.controller('BatteryDeviceFailedController', function ($scope, $timeout) {
    /**
     * Sets the internal 'failed' variable of the device object.
     * nodeId=x Node Id to be marked as failed.
     * @param {array} cmdArr
     */
    $scope.markFailedNode = function (cmdArr) {
        angular.forEach(cmdArr, function (v, k) {
            $scope.runZigbeeCmd(v);

        });
        //$scope.controlDh.input.failedBatteries = 0;
        $timeout(function () {
            $scope.controlDh.removed.failedBatteries.push($scope.controlDh.input.failedBatteries);
            $scope.controlDh.input.failedBatteries = 0;
        }, 1000);

    };
});

/**
 * The controller change function allows to handover the primary function to a different controller in
 * the network. The function works like a normal inclusion function but will hand over the primary
 * privilege to the new controller after inclusion. Z-Way will become a secondary controller of the network.
 * @class ControllerChangeController
 *
 */
appController.controller('ControllerChangeController', function ($scope) {
    /**
     * Set new primary controller
     * Start controller shift mode if 1 (True), stop if 0 (False)
     *  @param {string} cmd
     */
    $scope.controllerChange = function (cmd) {
        $scope.runZigbeeCmd(cmd);
    };
});

/**
 * This will call the Node Information Frame (NIF) from all devices in the network.
 * @class RequestNifAllController
 *
 */
appController.controller('RequestNifAllController', function ($scope, $timeout, $window, cfg, dataService, deviceService) {
    /**
     * Request NIF from all devices
     */
    $scope.requestNifAll = function (spin, $event) {
        $scope.toggleRowSpinner(spin);
        $scope.controlDh.process = true;
        dataService.runZigbeeCmd(cfg.call_all_nif).then(function (response) {
            deviceService.showNotifier({message: $scope._t('nif_request_complete')});
            $scope.toggleRowSpinner();
            $scope.controlDh.process = false;

            $scope.controlDh.network.inclusionProcess = false;
            $scope.controlDh.network.modal = false;
            $scope.handleModal();
            $timeout(function () {
                $window.location.reload();
            }, 3000);
        }, function (error) {
            $scope.toggleRowSpinner();
            deviceService.showNotifier({message: $scope._t('error_nif_request'), type: 'error'});
            $scope.controlDh.process = false;
            //$window.location.reload();
        });
    };
});

/**
 * This will call the Node Information Frame (NIF) from the controller.
 * @class SendNodeInformationController
 *
 */
appController.controller('SendNodeInformationController', function ($scope) {
    /**
     * Send NIF of the stick
     * Parameter nodeId: Destination Node Id (NODE BROADCAST to send non-routed broadcast packet)
     * @param {string} cmd
     */
    $scope.sendNodeInformation = function (cmd) {
        $scope.runZigbeeCmd(cmd);
    };
});

/**
 * This sets Promiscuous mode to true/false.
 * @class SetPromiscuousModeController
 *
 */
appController.controller('SetPromiscuousModeController', function ($scope) {
    /**
     * Sets promiscuous mode
     * @param {string} cmd
     */
    $scope.setPromiscuousMode = function (cmd) {
        $scope.runZigbeeCmd(cmd, 1000, true);
    };
});
