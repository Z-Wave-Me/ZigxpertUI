var configurationCommandsModule = angular.module('appConfigurationCommands', ['dataHolderModule', 'appService']);

configurationCommandsModule.service('configurationCommandsService', ['dataHolderService', 'deviceService', '$interval', 'cfg', '$rootScope', function (dataHolderService, deviceService, $interval, cfg, $rootScope) {
  const self = this;
  self.ccTable = {};
  var _methods_specs_rendered = null;
  function groupBy(arr, field){
    return arr?.reduce((acc, cur) => {
      const {[field]: key, ...other} = cur;
      return {...acc, [key]: acc[key] ? [...acc[key], other] : [other]}
    }, {});
  }
  /**
   * @typedef {string} cluster
   * @return {{cluster: {[values]: string[], [arrays]: string[]}}}
   */
  var serverCommands = function () {
    return {
      /*
        values: ['name1', 'name2']
        arrays: ['name1', 'name2']
        arraysInArrays: ['name1', 'name2']
      */
      OnOff: {
        values: ['onOff', 'globalSceneControl', 'onTime', 'offWaitTime']
      },
      LevelControl: {
        values: ['currentLevel', 'remainingTime', 'onOffTransitionTime', 'onLevel', 'onTransitionTime', 'offTransitionTime']
      },
      ColorControl: {
        values: ['currentHue', 'currentSaturation', 'remainingTime', 'colorMode']
      },
      IasZone: {
        values: ['zoneState', 'zoneType', 'zoneStatus', 'zoneId', 'CurrentZoneSensitivityLevel'],
      },
      PollControl: {
        values: ['checkInInterval', 'longPollInterval', 'shortPollInterval', 'fastPollTimeout', 'checkInIntervalMin', 'shortPollIntervalMin', 'fastPollTimeoutMax']
      },
      DoorLock: {
        values: ['lockState', 'lockType', 'actuatorEnabled', 'doorState', 'doorOpenEvents', 'doorClosedEvents', 'openPeriod', 'enableLogging', 'ledSettings', 'autoRelockTime', 'soundVolume', 'operatingMode', 'enableOneTouchLocking', 'enableInsideStatusLED', 'enablePrivacyModeButton', 'wrongCodeEntryLimit', 'userCodeTemporaryDisableTime', 'sendPINOverTheAir', 'requirePINforRFOperation', 'zigBeeSecurityLevel', 'alarmMask', 'keypadOperationEventMask', 'rfOperationEventMask', 'manualOperationEventMask', 'rfidOperationEventMask', 'keypadProgrammingEventMask', 'rfProgrammingEventMask', 'rfidProgrammingEventMask']
      },
      Alarm: {
        arrays: ['alarmTable', 'alarmCode', 'clusterId', 'timeStamp']
      }
    }
  }
  function nodeProperty() {
    return [
      {
        "label": "givenName",
        "type": {
          "string": {}
        },
        "defaultValue": "new name"
      }
    ]
  }

  this.serverCommand = function (cluster) {
    return serverCommands()[cluster] ?? {};
  }
  const commandConverter = (data) => ({
    type: {
      [data.format.value === 'bitmask' ? 'bitmask' : 'range']: {
        max: data.max.value,
        min: data.min.value,
        size: data.size.value
      }
    },
    default: data.default.value,
    title: data.title.value,
    description: data.description.value,
    readonly: data.readonly.value,
    failed: data.val.updateTime > data.val.invalidateTime,
    value: data.val.value,
    updateTime: data.val.updateTime,
    path: `devices[${self.nodeId}].endpoints[0].clusters[112]`
  });

  this.getConfigCommands = function (nodeId) {
    return Object.entries(dataHolderService.getRealNodeById(nodeId).endpoints[0].clusters[112].data)
      .filter(([key]) => Number.isInteger(+key)).map(([key, data]) => ({...commandConverter(data), index: +key}))
  }
  this.node = function () {
    const device = dataHolderService.getRealNodeById(self.nodeId).data;
    self.ccTable[`${self.nodeId}@Property`] = {
      table: nodeProperty().reduce((acc, cur) => {
        return {...acc, [cur.label]: [{
          data: device[cur.label]?.value,
            key: cur.label,
            updateTime: device[cur.label]?.updateTime,
            isUpdated: device[cur.label]?.updateTime > device[cur.label]?.invalidateTime,
            value: device[cur.label]?.value,
            cmd: `devices[${self.nodeId}].data.${cur.label}.value`
          }]
      }
      }, {})
    };
    return {
      name: dataHolderService.getRealNodeById(self.nodeId).data.givenName.value,
      path: `devices[${self.nodeId}]`,
      properties: Object
      .fromEntries(nodeProperty().map(entry => ([entry.label, {accessor: 'nodeProperty',
        fields: [entry]}])))
    }
  }
  this.getCommands = function (nodeId) {
    return dataHolderService.update().then(() => {
      const node = dataHolderService.getRealNodeById(nodeId);
      if (!node) throw new Error('No Device');
      return Object.entries(node.endpoints).reduce((acc, [endpointId, endpoint]) => {
        const classCommands = Object.entries(endpoint.clusters)
          .reduce((acc, [ccId, {data, name}]) => {
            const methods = configureCommand(ccId, data);
            const values = valueExtractor(data, self.serverCommand(name),
                `devices[${nodeId}].endpoints[${endpointId}].clusters[${ccId}].data`);
            acc.push({
              ccId: +ccId,
              name,
              methods,
              visible: !!Object.keys(methods).length || !!Object.keys(values).length,
              endpoint: +endpointId,
              path: `devices[${nodeId}].endpoints[${endpointId}].clusters[${ccId}]`,
              version: data.version.value,
            })
            self.ccTable[`${name}@${endpointId}`] = {
              endpointId: +endpointId,
              ccId: +ccId,
              name,
              data,
              nodeData: endpoint.data,
              updateTime: node.data.updateTime,
              table: values
            };
            return acc;
          }, [])
        return [...acc, ...classCommands];
      }, []);
    });
  }

  function updateCcTable(node) {
      self.ccTable[`${self.nodeId}@Property`] = {
        table: nodeProperty().reduce((acc, cur) => {
          return {...acc, [cur.label]: [{
              data: node.data[cur.label]?.value,
              key: cur.label,
              updateTime: node.data[cur.label]?.updateTime,
              isUpdated: node.data[cur.label]?.updateTime > node.data[cur.label]?.invalidateTime,
              cmd: `devices[${self.nodeId}].data.${cur.label}.value`
            }]
          }
        }, {})
    }
    Object.entries(node.endpoints).map(([endpointId, endpoint]) => {
      Object.entries(endpoint.clusters)
        .map(([ccId, {data, name}]) => {
          self.ccTable[`${name}@${endpointId}`] = {
            endpointId,
            ccId,
            name,
            data,
            nodeData: endpoint.data,
            updateTime: node.data.updateTime,
            table: valueExtractor(data, self.serverCommand(name),
              `devices[${self.nodeId}].endpoints[${endpointId}].clusters[${ccId}].data`)
          };
        })
    })
  }
  function packIt(targetField, data, key, value, cmd) {
    return {
      targetField,
      data: value.value,
      key,
      updateTime: value.updateTime,
      isUpdated: value.updateTime > value.invalidateTime,
      cmd
    }
  }

  function valueExtractor(data, {values, arrays, arraysInArrays}, baseCmd) {
    return groupBy(Object.entries(data).map(([key, value]) => {
      if (isNaN(+key)) {
        return values?.filter(targetField => targetField === key).map(targetField => {
          return packIt(targetField, data, key, value, `${baseCmd}.${targetField}.value`);
        })
      } else {
        if (arraysInArrays) {
          return Object.entries(value).map(([_key, value]) => {
            if (!value) return [];
            return Object.entries(value).map(([__key, value]) => {
              return arraysInArrays.filter(targetField => targetField === __key).map((targetField) => {
                return packIt(targetField, data, key + "." + _key, value, `${baseCmd}[${key}][${_key}].${targetField}.value`);
              })
            }).flat()
          }).flat()
        }
        return Object.entries(value).map(([_key, value]) => {
          return arrays?.filter(targetField => targetField === _key).map((targetField) => {
            return packIt(targetField, data, key, value, `${baseCmd}[${key}].${targetField}.value`);
          })
        }).flat()
      }
    }).flat().filter(data => data), 'targetField');
  }

  let dataUpdate = null

  this.init = function (nodeId) {
    self.nodeId = nodeId;
    return self.getCommands(nodeId).then((commands) => {
      $rootScope.$broadcast('configuration-commands:cc-table:update', self.ccTable);
      dataUpdate = $rootScope.$on('configuration-commands:zigbee-data:update', function (_, {ids, data}) {
        if (ids.has(self.nodeId)) {
          updateCcTable(data.devices[self.nodeId])
          $rootScope.$broadcast('configuration-commands:cc-table:update', self.ccTable);
        }
      });
      return commands;
    })
  }


  this.destroy = function () {
    if (dataUpdate) {
     dataUpdate();
   }
  }
  function configureCommand(ccId, clustersData) {
    return Object.entries(renderMethodSpec(parseInt(ccId, 10), clustersData))
      .reduce((acc, [name, data]) => {
        const accessor = Array.isArray(data) ? 'method': 'property';
        const fields = accessor === 'method' ? data : [data];
        acc[name] = {
          accessor,
          fields,
        }
        return acc;
      }, {})
  }

  function renderAllMethodSpec(ZigbeeAPIData) {
    _methods_specs_rendered = {};

    for (var devId in ZigbeeAPIData.devices) {
      _methods_specs_rendered[devId] = {};
      for (var instId in ZigbeeAPIData.devices[devId].endpoints) {
        _methods_specs_rendered[devId][instId] = {};
        for (var ccId in ZigbeeAPIData.devices[devId].endpoints[instId].clusters) {
          _methods_specs_rendered[devId][instId][ccId] = renderMethodSpec(parseInt(ccId, 10), ZigbeeAPIData.devices[devId].endpoints[instId].clusters[ccId].data);
        }
      }
    }
  }

  function renderMethodSpec(ccId, data) {
    switch (ccId) {

      // LevelControl
      case 0x0008:
        return {
          "overrideDefaultDuration": {
            "label": "If not specifically specified in Set, use this duration instead of the device default value",
            "type": {
              "enumof": [
                {
                  "label": "use device default",
                  "type": {
                    "fix": {
                      "value": null
                    }
                  }
                },
                {
                  "label": "immediately",
                  "type": {
                    "fix": {
                      "value": 0
                    }
                  }
                },
                {
                  "label": "in seconds",
                  "type": {
                    "range": {
                      "min": 1,
                      "max": 127
                    }
                  }
                },
                {
                  "label": "in minutes",
                  "type": {
                    "range": {
                      "min": 1,
                      "max": 127,
                      "shift": 127
                    }
                  }
                }
              ]
            }
          },
          "Get": [],
          "MoveToLevelOnOff": [
            {
              "label": "Dimmer level",
              "type": {
                "enumof": [
                  {
                    "label": "Off",
                    "type": {
                      "fix": {
                        "value": 0
                      }
                    }
                  },
                  {
                    "label": "Level",
                    "type": {
                      "range": {
                        "min": 0,
                        "max": 255
                      }
                    }
                  },
                  {
                    "label": "Full",
                    "type": {
                      "fix": {
                        "value": 255
                      }
                    }
                  }
                ]
              }
            },
            {
              "label": "Duration",
              "type": {
                "enumof": [
                  {
                    "label": "immediately",
                    "type": {
                      "fix": {
                        "value": 0
                      }
                    }
                  },
                  {
                    "label": "in seconds",
                    "type": {
                      "range": {
                        "min": 1,
                        "max": 255
                      }
                    }
                  }
                ]
              }
            }
          ],
          "StartLevelChange": [
            {
              "label": "Direction",
              "type": {
                "enumof": [
                  {
                    "label": "Up",
                    "type": {
                      "fix": {
                        "value": 0
                      }
                    }
                  },
                  {
                    "label": "Down",
                    "type": {
                      "fix": {
                        "value": 1
                      }
                    }
                  }
                ]
              }
            },
            {
              "label": "Duration",
              "type": {
                "enumof": [
                  {
                    "label": "immediately",
                    "type": {
                      "fix": {
                        "value": 0
                      }
                    }
                  },
                  {
                    "label": "in seconds",
                    "type": {
                      "range": {
                        "min": 1,
                        "max": 255
                      }
                    }
                  }
                ]
              }
            }
          ],
          "StopLevelChange": []
        };

      // OnOff
      case 0x0006:
        return {
          "Get": [],
          "Set": [
            {
              "label": "Level",
              "type": {
                "enumof": [
                  {
                    "label": "Off",
                    "type": {
                      "fix": {
                        "value": 0
                      }
                    }
                  },
                  {
                    "label": "On",
                    "type": {
                      "fix": {
                        "value": 255
                      }
                    }
                  }
                ]
              }
            }
          ]
        };

      default:
        return {};
    }
  }

  // device filter for device select menu
  function devicesHtmlSelectFilter(ZigbeeAPIData, span, dev, type) {
    // return true means to skip this node
    switch (type) {
      case 'srcnode':
        // allow everything, since events can come from any device via timed_event
        return false;

      // skip virtual, controller or broadcast as event source
      //return ( (ZigbeeAPIData.devices[dev].data.isVirtual.value || dev == ZigbeeAPIData.controller.data.nodeId.value || dev == 255));

      case 'dstnode':
        // skip not virtual, not controller and not broadcast as event destination
        return (!(ZigbeeAPIData.devices[dev].data.isVirtual.value || dev == ZigbeeAPIData.controller.data.nodeId.value || dev == 255));

      case 'device':
        return ZigbeeAPIData.devices[dev].data.isVirtual.value || dev == ZigbeeAPIData.controller.data.nodeId.value;

      case 'node':
        // skip non-FLiRS sleeping in list of associations/wakeup node notifications/... in CC params of type node
        return (!ZigbeeAPIData.devices[dev].data.isListening.value && !ZigbeeAPIData.devices[dev].data.sensor250.value && !ZigbeeAPIData.devices[dev].data.sensor1000.value);

      default:
        return false;
    }
  }

  // returns array with default values: first value from the enum, minimum value for range, empty string for string, first nodeId for node, default schedule for the climate_schedule
  function methodDefaultValues(ZigbeeAPIData, method) {

    function methodDefaultValue(val) {
      if ('enumof' in val['type']) {
        if (val['type']['enumof'][0])
          return methodDefaultValue(val['type']['enumof'][0]); // take first item of enumof
        else
          return null;
      }
      if ('range' in val['type'])
        return val['type']['range']['min'];
      if ('fix' in val['type'])
        return val['type']['fix']['value'];
      if ('string' in val['type'])
        return "";
      if ('node' in val['type'])
        for (var dev in ZigbeeAPIData.devices) {
          if (devicesHtmlSelectFilter(ZigbeeAPIData, null, dev, 'node')) {
            continue;
          }
          return parseInt(dev);
        }
      alert('method_defaultValue: unknown type of value');
    }

    var parameters = [];
//	method.forEach(function(val,parameter_index){
//		parameters[parameter_index] = method_defaultValue(val);
//	});
    angular.forEach(method, function (val, parameter_index) {
      parameters[parameter_index] = methodDefaultValue(val);
    });

    return parameters;
  }

// represent array with number, string and array elements in reversible way: use eval('[' + return_value + ']') to rever back to an array
//   function reprArray(arr) {
//     var repr = '';
//     for (var index in arr) {
//       if (repr !== '')
//         repr += ',';
//       switch (typeof (arr[index])) {
//         case 'number':
//           repr += arr[index].toString();
//           break;
//         case 'string':
//           repr += "'" + arr[index].replace(/'/g, "\'") + "'"; // " // just for joe to hilight syntax properly
//           break;
//         case 'object':
//           repr += '[' + reprArray(arr[index]) + ']';
//           break;
//         default:
//           if (arr[index] === null)
//             repr += 'null'; // for null object
//           else
//             error_msg('Unknown type of parameter: ' + typeof (arr[index]));
//       }
//     }
//
//     return repr;
//   }

}])
