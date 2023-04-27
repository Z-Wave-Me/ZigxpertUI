/**
 * @overview This controller renders and handles device interview stuff.
 * @author Martin Vach
 */

/**
 * Device interview controller
 * @class ConfigInterviewController
 *
 */
appController.controller('ConfigInterviewController', function ($scope, $routeParams, $route, $location, $cookies, $filter, $http, $timeout, $interval, cfg, dataService, deviceService, myCache) {
  $scope.devices = [];
  $scope.deviceName = '';
  $scope.deviceId = 0;
  //$scope.activeTab = 'interview';
  $scope.activeUrl = 'configuration/interview/';
  $cookies.tab_config = 'interview';
  $scope.modelSelectZddx = false;
  $scope.zigbeeInterview = {
      interval: null,
      progress: 0,
      clustersCnt: 0,
      interviewDoneCnt: 0
    },
    $scope.isController = false;
  $scope.showInterview = true;

  // Interview data
  $scope.descriptionCont;
  $scope.deviceZddx = [];

  /**
   * Cancel interval on page destroy
   */
  $scope.$on('$destroy', function () {
    $interval.cancel($scope.zigbeeInterview.interval);
  });

  // Load data
  $scope.load = function (nodeId) {
    //nodeId = parseInt(nodeId,10);
    dataService.loadZigbeeApiData().then(function (ZigbeeAPIData) {
      $scope.ZigbeeAPIData = ZigbeeAPIData;
      $scope.devices = deviceService.configGetNav(ZigbeeAPIData);
      if (_.isEmpty($scope.devices)) {
        $scope.alert = {
          message: $scope._t('device_404'),
          status: 'alert-warning',
          icon: 'fa-exclamation-circle'
        };
        return;
      }
      var node = ZigbeeAPIData.devices[nodeId];
      if (!node || deviceService.notDevice(ZigbeeAPIData, node, nodeId)) {
        return;
      }

      //check if node is controller
      $scope.isController = parseInt(nodeId, 10) === cfg.controller.zbeeNodeId;

      $cookies.configuration_id = nodeId;
      $cookies.config_url = $scope.activeUrl + nodeId;
      $scope.deviceId = nodeId;
      $scope.deviceName = $filter('deviceName')(nodeId, node);
      //hide interview if node is controller
      $scope.showInterview = !$scope.isController;
      checkInterview(node);
      setData(ZigbeeAPIData, nodeId);
      $scope.refreshZigbeeData();
      /* dataService.loadJoinedZigbeeData(ZigbeeAPIData).then(function(response) {
           node = response.data.joined.devices[nodeId];
           refreshData(node, nodeId, response.data.joined);
           $scope.ZigbeeAPIData = ZigbeeAPIData;
       });*/
    });
  };
  $scope.load($routeParams.nodeId);

  /**
   * Refresh zigbee data
   * @param {object} ZigbeeAPIData
   */
  $scope.refreshZigbeeData = function () {
    var refresh = function () {
      dataService.loadJoinedZigbeeData().then(function (response) {
        var node = response.data.joined.devices[$routeParams.nodeId];
        refreshData(node, $routeParams.nodeId, response.data.joined);
      });
    };
    $scope.zigbeeInterview.interval = $interval(refresh, $scope.cfg.interval);
  };

  // Redirect to device
  $scope.redirectToDevice = function (deviceId) {
    if (deviceId) {
      $location.path($scope.activeUrl + deviceId);
    }
  };

  /**
   * Request NIF of a device
   * Node Id to be requested for a NIF
   * @param {string} cmd
   */
  $scope.requestNodeInformation = function (cmd) {
    $scope.runZigbeeCmd(cmd);
  };

  /**
   * Purge all command classes and start interview based on device's NIF
   * @param {string} cmd
   */
  $scope.interviewForce = function (cmd) {
    $scope.runZigbeeCmd(cmd);
  };

  /**
   * Purge all command classes and start interview for a device
   * @param {string} cmd
   */
  $scope.interviewForceDevice = function (cmd) {
    $scope.runZigbeeCmd(cmd);
  };

  /**
   * Show modal CommandClass dialog
   * @param target
   * @param $event
   * @param endpointId
   * @param ccId
   * @param type
   */
  $scope.handleCmdClassModal = function (target, $event, endpointId, ccId, type) {
    var node = $scope.ZigbeeAPIData.devices[$routeParams.nodeId];
    var ccData;
    switch (type) {
      case 'cmdData':
        ccData = $filter('hasNode')(node, 'endpoints.' + endpointId + '.clusters.' + ccId + '.data');
        break;
      case 'cmdDataIn':
        ccData = $filter('hasNode')(node, 'endpoints.' + endpointId + '.data');
        break;
      default:
        ccData = $filter('hasNode')(node, 'data');
        break;
    }
    var cc = deviceService.configGetCommandClass(ccData, '/', '');

    $scope.endpoint = deviceService.configSetCommandClass(cc);
    $scope.handleModal(target, $event);
    //$(target).modal();
  };

  /**
   * Rename Device action
   */
  $scope.renameDevice = function (form, deviceName, spin) {
    if (!form.$dirty) {
      return;
    }
    var timeout = 1000;
    // encodeURIComponent(myUrl);
    //var cmd = 'devices[' + $scope.deviceId + '].data.givenName.value="' + escape(deviceName) + '"';
    var cmd = 'devices[' + $scope.deviceId + '].data.givenName.value="' + encodeURIComponent(deviceName) + '"';
    $scope.toggleRowSpinner(spin);
    dataService.runZigbeeCmd(cfg.store_url + cmd).then(function (response) {

      $timeout(function () {
        form.$setPristine();
        $scope.toggleRowSpinner();
        $scope.load($routeParams.nodeId);

      }, timeout);

      dataService.postApi('store_url', null, 'devices.SaveData()');
      
    }, function (error) {
      $scope.toggleRowSpinner();
    });
  };

  /// --- Private functions --- ///
  /**
   * Set zigbee data
   */
  function setData(ZigbeeAPIData, nodeId, refresh) {
    var node = ZigbeeAPIData.devices[nodeId];
    if (!node) {
      return;
    }
    $scope.showDevices = true;
    $scope.deviceName = $filter('deviceName')(nodeId, node);
    $scope.deviceNameId = $filter('deviceName')(nodeId, node) + ' (#' + nodeId + ')';
    $scope.hasBattery = 0x80 in node.endpoints[0].clusters;
    var zddXmlFile = null;
    if (angular.isDefined(node.data.ZDDXMLFile)) {
      zddXmlFile = node.data.ZDDXMLFile.value;
      $scope.deviceZddxFile = node.data.ZDDXMLFile.value;
    }

    $scope.interviewCommands = deviceService.configGetInterviewCommands(node, ZigbeeAPIData.updateTime);
    $scope.interviewCommandsDevice = node.data;
    if (zddXmlFile && zddXmlFile !== 'undefined') {
      $http.get($scope.cfg.server_url + $scope.cfg.zddx_url + zddXmlFile).then(function (response) {
        var x2js = new X2JS();
        var zddXml = x2js.xml_str2json(response.data);
        myCache.put(zddXmlFile, zddXml);
        $scope.descriptionCont = setCont(node, nodeId, zddXml, ZigbeeAPIData, refresh);
      }, function (response) {
        $scope.descriptionCont = setCont(node, nodeId, null, ZigbeeAPIData, refresh);
      });
    } else {
      $scope.descriptionCont = setCont(node, nodeId, null, ZigbeeAPIData, refresh);
    }
  }

  /**
   * Check interview
   */
  function checkInterview(node) {
    $scope.zigbeeInterview.clustersCnt = 0;
    $scope.zigbeeInterview.interviewDoneCnt = 0;
    if (!node) {
      return;
    }
    for (var iId in node.endpoints) {
      /* if (Object.keys(node.endpoints[iId].clusters).length < 1) {
           return;
       }*/
      //angular.extend($scope.zigbeeInterview, {clustersCnt: Object.keys(node.endpoints[iId].clusters).length});
      $scope.zigbeeInterview.clustersCnt += Object.keys(node.endpoints[iId].clusters).length;
      for (var ccId in node.endpoints[iId].clusters) {
        var cmdClass = node.endpoints[iId].clusters[ccId];
        // Is interview done?
        if (cmdClass.data.interviewDone.value) {

          // If an interview is done deleting from interviewNotDone
          // Extending an interview counter
          angular.extend($scope.zigbeeInterview, {
            interviewDoneCnt: $scope.zigbeeInterview.interviewDoneCnt + 1
          });
        }
      }
    }

    var clustersCnt = $scope.zigbeeInterview.clustersCnt;
    var intervewDoneCnt = $scope.zigbeeInterview.interviewDoneCnt;
    var progress = ((intervewDoneCnt / clustersCnt) * 100).toFixed();
    /*console.log('clustersCnt: ', clustersCnt);
    console.log('intervewDoneCnt: ', intervewDoneCnt);
    console.log('Percent %: ', progress);*/
    $scope.zigbeeInterview.progress = (progress >= 100 ? 100 : progress);

  };

  /**
   * Device description
   */
  function setCont(node, nodeId, zddXml, ZigbeeAPIData, refresh) {
    // Set device data
    var deviceImage = 'app/images/no_device_image.png';
    var deviceDescription = '';
    var productName = '';
    var inclusionNote = '';
    var brandName = 'TBD';
    var wakeupNote = '';
    var ZigbeePlusRoles = [];
    var securityInterview = '';
    var deviceDescriptionAppVersion = 'TBD';//parseInt(node.data.applicationMajor.value, 10);
    var deviceDescriptionAppSubVersion = 'TBD';//parseInt(node.data.applicationMinor.value, 10);
    var isSleepy = node.data.isSleepy.value;
    var manualUrl = "";
    var certNumber = "";
    var productCode = "";

    // Security S2
    var hasSecurityS2Cc = deviceService.hasCommandClass(node, 159);
    var securityS2Key = deviceService.getS2GrantedKeys(hasSecurityS2Cc);

    var hasWakeup = isSleepy;
    if (isNaN(deviceDescriptionAppVersion))
      deviceDescriptionAppVersion = '-';
    if (isNaN(deviceDescriptionAppSubVersion))
      deviceDescriptionAppSubVersion = '-';
    var zbNodeName = '';
    if (0x77 in node.endpoints[0].clusters) {
      // NodeNaming
      zbNodeName = node.endpoints[0].clusters[0x77].data.nodename.value;
      if (zbNodeName != '') {
        zbNodeName = ' (' + zbNodeName + ')';
      }


    }
    // Security interview
    if (0x9F in node.endpoints[0].clusters) {
      securityInterview = node.endpoints[0].clusters[0x9F].data.interviewDone.value && !node.endpoints[0].clusters[0x9F].data.securityAbandoned.value && node.data.secureChannelEstablished.value;
    }
    else if (0x98 in node.endpoints[0].clusters) {
      securityInterview = node.endpoints[0].clusters[0x98].data.interviewDone.value && !node.endpoints[0].clusters[0x98].data.securityAbandoned.value && node.data.secureChannelEstablished.value;
    }

    var sdk = 'TDB';
    /*
    if (!$scope.isController && node.data.SDK.value == '') {
      sdk = '(' + node.data.ZWProtocolMajor.value + '.' + node.data.ZWProtocolMinor.value + ')';
    } else {
      sdk = $scope.isController ? ZigbeeAPIData.controller.data.SDK.value : node.data.SDK.value;
    }
    */

    // Command class
    var ccNames = [];
    angular.forEach($scope.interviewCommands, function (v, k) {
      ccNames.push(v.ccName);
    });
    // Has device a zddx XML file
    if (zddXml) {
      deviceDescription = deviceService.configGetZddxLang($filter('hasNode')(zddXml, 'ZigbeeDevice.deviceDescription.description.lang'), $scope.lang);
      inclusionNote = deviceService.configGetZddxLang($filter('hasNode')(zddXml, 'ZigbeeDevice.deviceDescription.inclusionNote.lang'), $scope.lang);
      wakeupNote = deviceService.configGetZddxLang($filter('hasNode')(zddXml, 'ZigbeeDevice.deviceDescription.wakeupNote.lang'), $scope.lang);



      if ('brandName' in zddXml.ZigbeeDevice.deviceDescription) {
        brandName = zddXml.ZigbeeDevice.deviceDescription.brandName;
      }

      if ('productName' in zddXml.ZigbeeDevice.deviceDescription) {
        productName = zddXml.ZigbeeDevice.deviceDescription.productName;
      }

      if ('resourceLinks' in zddXml.ZigbeeDevice && angular.isDefined(zddXml.ZigbeeDevice.resourceLinks.deviceImage)) {
        deviceImage = zddXml.ZigbeeDevice.resourceLinks.deviceImage._url;
      }

      if ('resourceLinks' in zddXml.ZigbeeDevice && angular.isDefined(zddXml.ZigbeeDevice.resourceLinks.manualUrl)) {
        manualUrl = zddXml.ZigbeeDevice.resourceLinks.manualUrl._url;
      }

      if ('deviceData' in zddXml.ZigbeeDevice && angular.isDefined(zddXml.ZigbeeDevice.deviceData.certNumber)) {
        certNumber = zddXml.ZigbeeDevice.deviceData.certNumber;
      }

      if ('productCode' in zddXml.ZigbeeDevice.deviceDescription) {
        productCode = zddXml.ZigbeeDevice.deviceDescription.productCode;
      }



      /**
       * TODO: finish ZigbeePlusRoles
       */
      if (angular.isDefined(zddXml.ZigbeeDevice.RoleTypes)) {
        angular.forEach(zddXml.ZigbeeDevice.RoleTypes, function (v, k) {
          ZigbeePlusRoles.push(v);
        });
      }
    }

    // Set device image
    $scope.deviceImage = deviceImage;
    // OBJ
    var obj = {};
    obj["a"] = {
      "key": "device_node_id",
      "val": nodeId
    };
    obj["d"] = {
      "key": "device_description_brand",
      "val": brandName
    };
    obj["e"] = {
      "key": "device_description_device_type",
      "val": 'TBD' //node.data.deviceTypeString.value
    };
    obj["f"] = {
      "key": "device_description_product",
      "val": productName
    };
    obj["g"] = {
      "key": "device_description_description",
      "val": deviceDescription
    };
    obj["h"] = {
      "key": "device_description_inclusion_note",
      "val": inclusionNote
    };
    if (hasWakeup) {
      obj["i"] = {
        "key": "device_description_wakeup_note",
        "val": wakeupNote
      };
    }

    // obj["j"] = {"key": "device_description_interview", "val": deviceService.configInterviewStage(ZigbeeAPIData, nodeId, $scope.languages)};
    //obj["k"] = {"key": "device_interview_indicator", "val": interviewDone};
    
    // don't show it from controller itself
    if (ZigbeeAPIData.controller.data.nodeId.value != nodeId) { // non-strict comparison since nodeId is a key string
      obj["l"] = {
        "key": "device_sleep_state",
        "val": deviceService.configDeviceState(node, $scope.languages)
      };
      obj["m"] = {
        "key": "device_description_app_version",
        "val": deviceDescriptionAppVersion + '.' + deviceDescriptionAppSubVersion
      };
    }
    obj["o"] = {
      "key": "device_description_sdk_version",
      "val": sdk
    };
    obj["p"] = {
      "key": "command_class",
      "val": ccNames
    };
    obj["q"] = {
      "key": "zigbee_role_type",
      "val": ZigbeePlusRoles.join(', ')
    };
    if (deviceService.isLocalyReset(node)) {
      obj["r"] = {
        "key": "device_reset_locally",
        "val": '<i class="' + $filter('checkedIcon')(true) + '"></i>'
      };
    }
    if (typeof securityInterview === 'boolean') {
      obj["s"] = {
        "key": "device_security_interview",
        "val": '<i class="' + $filter('checkedIcon')(securityInterview) + '"></i>'
      };
    }
    obj["u"] = {
      "key": "granted_keys",
      "val": securityS2Key.join()
    };

    if (certNumber != "") {
      obj["w"] = {
        "key": "Certification-Nr.",
        "val": certNumber
      };
    }


    obj["x"] = {
      "key": "Productcode",
      "val": productCode
    };

    lang = $scope.lang.toUpperCase();

    if (certNumber != "") {
      obj["y"] = {
        "key": "Manual",
        "val": "<a href='http://manuals-backend.zigbee.info/make.php?lang=" + lang + "&cert=" + certNumber + "' target=_blank> Manual </a>"
      }
    };

    return obj;

  }

  /**
   * Refresh description cont
   */
  function refreshData(node, nodeId, ZigbeeAPIData) {
    checkInterview(node);
    $scope.interviewCommands = deviceService.configGetInterviewCommands(node, ZigbeeAPIData.updateTime);
    // todo: deprecated
    //$('#device_sleep_state .config-interview-val').html(deviceService.configDeviceState(node, $scope.languages));
    //$('#device_description_interview .config-interview-val').html(deviceService.configInterviewStage(ZigbeeAPIData, nodeId, $scope.languages));
  }
});