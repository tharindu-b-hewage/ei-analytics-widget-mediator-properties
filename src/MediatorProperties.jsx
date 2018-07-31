import React from 'react'; // todo: unused, liecence header
import Widget from '@wso2-dashboards/widget';

const META_TENANT_ID = '-1234';

class MediatorProperties extends Widget {
    constructor(props) {
        super(props);
        this.state = {
            isNoData: true,
            messageComparisonData: null
        };
        this.isChildDataPresent = false;
    }

    componentWillMount() {
        // Handle attributes published from the clicked mediator
        super.subscribe((mediatorAttributes) => {
            if ('componentId' in mediatorAttributes) {
                // If a mediator clicked, data is allowed stored again until a component data with
                // children data is stored
                this.isChildDataPresent = false;
                this.setState({
                    isNoData: true
                }, () => {
                    let componentId = mediatorAttributes.componentId;
                    let queryParameters = getQueryString();
                    let messageFlowId = queryParameters.id;

                    // Get message flow details of the mediator
                    super.getWidgetConfiguration(this.props.widgetID)
                        .then((message) => {
                            // Get data provider sub json string from the widget configuration
                            let dataProviderConf = message.data.configs.providerConfig;
                            var query = dataProviderConf.configs.config.queryData
                                .GET_MESSAGE_FLOW_DATA_QUERY;
                            // Insert required parameters to the query string
                            let formattedQuery = query
                                .replace("{{messageFlowId}}", messageFlowId)
                                .replace("{{componentId}}", componentId)
                                .replace("{{meta_tenantId}}", META_TENANT_ID);
                            dataProviderConf.configs.config.queryData = {query: formattedQuery};
                            // Request data store with the modified query
                            super.getWidgetChannelManager()
                                .subscribeWidget(
                                    this.props.id,
                                    this.handleComponentMessageFlowData(messageFlowId).bind(this),
                                    dataProviderConf
                                );
                        })
                        .catch((error) => {
                            // todo: Handle error
                        });
                })
            }
        });
    }

    handleComponentMessageFlowData(messageFlowId) {
        return (messageFlowData) => {
            let messageInfoBefore = parseDatastoreMessage(messageFlowData)[0];
            if (messageInfoBefore["children"] != null && messageInfoBefore["children"] != "null") {
                let childIndex = JSON.parse(messageInfoBefore["children"])[0];

                // Get message flow details of the child component
                super.getWidgetConfiguration(this.props.widgetID)
                    .then((message) => {
                        // Get data provider sub json string from the widget configuration
                        let dataProviderConf = message.data.configs.providerConfig;
                        var query = dataProviderConf.configs.config.queryData
                            .GET_CHILD_MESSAGE_FLOW_DATA_QUERY;
                        // Insert required parameters to the query string
                        let formattedQuery = query
                            .replace("{{messageFlowId}}", messageFlowId)
                            .replace("{{componentIndex}}", childIndex)
                            .replace("{{meta_tenantId}}", META_TENANT_ID);
                        dataProviderConf.configs.config.queryData = {query: formattedQuery};
                        // Request data store with the modified query
                        super.getWidgetChannelManager()
                            .subscribeWidget(
                                this.props.id,
                                this.handleChildMessageFlowData(messageInfoBefore).bind(this),
                                dataProviderConf
                            );
                    })
                    .catch((error) => {
                        // todo: Handle error
                    });
                /*
                If DB returned nothing, still continue the process
                 */
                this.handleChildMessageFlowData(messageInfoBefore)('');
            }
            else {
                // If child details not available, continue  with the normal flow
                this.handleChildMessageFlowData(messageInfoBefore)('');
            }
        }
    }

    handleChildMessageFlowData(messageInfoBefore) {
        return (childMessageDetails) => {
            let messageInfoAfter = {};
            if (childMessageDetails !== '') {
                messageInfoAfter = parseDatastoreMessage(childMessageDetails)[0];
            }
            let result = {};
            result["payload"] = {
                'before': messageInfoBefore["beforePayload"],
                'after': messageInfoBefore["afterPayload"]
            };

            let transportProperties = [];
            let contextProperties = [];
            let transportPropertyMapBefore;
            let contextPropertyMapBefore;

            if (messageInfoBefore["transportPropertyMap"] != null) {
                transportPropertyMapBefore = processProperties(messageInfoBefore["transportPropertyMap"]);
            } else {
                transportPropertyMapBefore = {};
            }
            if (messageInfoBefore["contextPropertyMap"] != null) {
                contextPropertyMapBefore = processProperties(messageInfoBefore["contextPropertyMap"]);
            } else {
                contextPropertyMapBefore = {};
            }

            let allTransportProperties = Object.keys(transportPropertyMapBefore);
            let allContextProperties = Object.keys(contextPropertyMapBefore);
            let transportPorpertyMapAfter;
            let contextPorpertyMapAfter;

            if (messageInfoAfter != null) {
                if (messageInfoAfter["transportPropertyMap"] != null) {
                    transportPorpertyMapAfter = processProperties(messageInfoAfter["transportPropertyMap"]);
                } else {
                    transportPorpertyMapAfter = {};
                }
                if (messageInfoAfter["contextPropertyMap"] != null) {
                    contextPorpertyMapAfter = processProperties(messageInfoAfter["contextPropertyMap"]);
                } else {
                    contextPorpertyMapAfter = {};
                }

                for (let property in transportPorpertyMapAfter) {
                    if (allTransportProperties.indexOf(property) < 0) {
                        allTransportProperties.push(property);
                    }
                }
                for (let property in contextPorpertyMapAfter) {
                    if (allContextProperties.indexOf(property) < 0) {
                        allContextProperties.push(property);
                    }
                }
            }
            // Add Transport Properties
            for (let property in allTransportProperties) {
                let propertyName = allTransportProperties[property];
                let beforeValue;
                let afterValue;
                if (transportPropertyMapBefore.hasOwnProperty(propertyName)) {
                    beforeValue = transportPropertyMapBefore[propertyName];
                } else {
                    beforeValue = "N/A";
                }
                if (messageInfoAfter != null) {
                    if (transportPorpertyMapAfter.hasOwnProperty(propertyName)) {
                        afterValue = transportPorpertyMapAfter[propertyName];
                    } else {
                        afterValue = "N/A";
                    }
                } else {
                    afterValue = beforeValue;
                }
                transportProperties.push({"name": propertyName, "before": beforeValue, "after": afterValue});
            }
            result["transportProperties"] = transportProperties;

            // Add Context Properties
            for (let property in allContextProperties) {
                let propertyName = allContextProperties[property];
                let beforeValue;
                let afterValue;
                if (contextPropertyMapBefore.hasOwnProperty(propertyName)) {
                    beforeValue = contextPropertyMapBefore[propertyName];
                } else {
                    beforeValue = "N/A";
                }
                if (messageInfoAfter != null) {
                    if (contextPorpertyMapAfter.hasOwnProperty(propertyName)) {
                        afterValue = contextPorpertyMapAfter[propertyName];
                    } else {
                        afterValue = "N/A";
                    }
                } else {
                    afterValue = beforeValue;
                }
                contextProperties.push({"name": propertyName, "before": beforeValue, "after": afterValue});
            }
            result["contextProperties"] = contextProperties;

            // If child data is not present in recent state update, update state
            if (!this.isChildDataPresent) {
                this.isChildDataPresent = childMessageDetails !== '';
                this.setState({
                    isNoData: false,
                    messageComparisonData: result
                });
            }
        }
    }

    render() {
        return (
            <div>
                {this.state.isNoData ? 'No Data' : JSON.stringify(this.state.messageComparisonData)}
            </div>
        )
    }
}

/**
 * Combine meta data and data separated data store message in to an object with names as attributes
 * @param recievedData
 * @returns {Array}
 */
function parseDatastoreMessage(recievedData) {
    let parsedArray = [];
    let dataMapper = {};

    let dataArray = recievedData.data;
    let metaData = recievedData.metadata.names;

    metaData.forEach((value, index) => {
        dataMapper[index] = value;
    });
    dataArray.forEach((dataPoint) => {
        let parsedObject = {};
        dataPoint.forEach((value, index) => {
            parsedObject[dataMapper[index]] = value;
        });
        parsedArray.push(parsedObject);
    })

    return parsedArray;
}

/**
 * Get query parameters parsed in to an object
 */
function getQueryString() {
    var queryStringKeyValue = window.parent.location.search.replace('?', '').split('&');
    var qsJsonObject = {};
    if (queryStringKeyValue != '') {
        for (let i = 0; i < queryStringKeyValue.length; i++) {
            qsJsonObject[queryStringKeyValue[i].split('=')[0]] = queryStringKeyValue[i].split('=')[1];
        }
    }
    return qsJsonObject;

};

/**
 * Split and process elements in any map of properties, if given in "{name1=value1, name2=value2 }" format.
 * in the publisher-end.
 */
function processProperties(propertyMap) {
    var output = {};
    if (propertyMap) {
        var properties = propertyMap.slice(1, -1).split(",");
        for (let i = 0; i < properties.length; i++) {
            var property = properties[i];
            if ((i + 1 < properties.length) && (properties[i + 1].indexOf('=') === -1)) {
                property = property + "," + properties[i + 1];
            }
            if (property.indexOf('=') === -1) {
                continue;
            } else {
                var nameValuePair = property.split("=");
                output[nameValuePair[0]] = nameValuePair[1];
                for (let j = 2; j < nameValuePair.length; j++) {
                    if (nameValuePair[j]) {
                        output[nameValuePair[0]] += "=" + nameValuePair[j];
                    }
                }
            }
        }
        return output;
    } else {
        return {};
    }
}

global.dashboard.registerWidget('MediatorProperties', MediatorProperties);