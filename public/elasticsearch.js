import module from './module';

module

    .service('backstage.elasticizer.elasticsearch.ElasticsearchClient', [
        'esFactory',
        'esUrl',
        'esRequestTimeout',
        'esApiVersion',
        function (esFactory, esUrl, esRequestTimeout, esApiVersion) {
            return esFactory({
                host: esUrl.replace('elasticsearch', 'elasticizer/api'),
                log: 'info',
                requestTimeout: esRequestTimeout,
                apiVersion: esApiVersion
            });
        }
    ])

    .service('backstage.elasticizer.elasticsearch.Elasticsearch', [
        'backstage.elasticizer.elasticsearch.ElasticsearchClient',
        function (ElasticsearchClient) {
            let self = this;

            this.client = ElasticsearchClient;

            ElasticsearchClient.indices.getAlias().then(res => {
                self.indices = res;
                self.indexMap = Object.keys(res).map(key => {
                    return {
                        name: key,
                        aliases: Object.keys(res[key].aliases || {})
                    };
                });
            });

            ElasticsearchClient.indices.getMapping().then(res => {
                self.mappings = res;
            });
        }
    ])

    .service('backstage.elasticizer.elasticsearch.Document', [
        '$q',
        'backstage.elasticizer.elasticsearch.Elasticsearch',
        'backstage.elasticizer.alerts.Alerts',
        function ($q, Elasticsearch, Alerts) {
            this.remove = document => {
                if (window.confirm('Are you sure you want to delete document ' + document._id + '?')) {
                    return Elasticsearch.client.delete({
                        index: document._index,
                        type: document._type,
                        id: document._id
                    }).then(() => {
                        Alerts.success('Document deleted.');
                    }).catch(err => {
                        Alerts.error(err);
                    });
                } else {
                    return $q.reject();
                }
            };
        }
    ])

    .controller('bseSearchCtrl', [
        '$scope',
        '$route',
        '$routeParams',
        '$location',
        'backstage.elasticizer.elasticsearch.Elasticsearch',
        'backstage.elasticizer.elasticsearch.Document',
        'backstage.elasticizer.alerts.Alerts',
        function ($scope, $route, $routeParams, $location, Elasticsearch, Document, Alerts) {
            function unEmpty(str, valueIfEmpty) {
                return str && str.length ? str : valueIfEmpty;
            }

            $scope.query = {
                index: $routeParams.index,
                type: $routeParams.type,
                q: unEmpty($routeParams.q),
                sort: unEmpty($routeParams.sort),
                from: unEmpty($routeParams.from, 0),
                size: 10
            };

            $scope.$route = $route;
            $scope.elasticsearch = Elasticsearch;
            $scope.spinning = false;
            $scope.pagination = {currentPage: $scope.query.from / $scope.query.size + 1};

            $scope.search = () => {
                $scope.spinning = true;

                let query = angular.extend({}, $scope.query, {
                    q: unEmpty($scope.query.q),
                    from: ($scope.pagination.currentPage - 1) * $scope.query.size
                });

                Elasticsearch.client
                    .search(query)
                    .then(res => {
                        $scope.results = res;
                        $scope.spinning = false;
                    }, err => {
                        Alerts.error(err);
                        $scope.spinning = false;
                    })
                    .finally(() => $scope.spinning = false);

                $route.updateParams({from: query.from});
            };

            $scope.remove = (doc, index) => {
                Document.remove(doc).then(() => {
                    $scope.results.hits.hits.splice(index, 1);
                });
            };

            $scope.new = () => {
                $location.path('/new').search({
                    index: $scope.query.index,
                    type: $scope.query.type
                });
            };

            $scope.bulk = () => {
                $location.path('/bulk').search({
                    index: $scope.query.index,
                    type: $scope.query.type,
                    q: $scope.query.q
                });
            };

            $scope.export = () => {
                let data = $scope.results.hits.hits.map(hit => hit._source);
                let blob = new Blob([angular.toJson(data, true)], {type: 'application/json'});
                let a = document.createElement('a');
                a.href = window.URL.createObjectURL(blob);
                a.download = ($scope.query.index || 'all-indices') + '_' + ($scope.query.type || 'all-types') + '_' +
                    ($scope.query.q || 'no-query').replace(' ', '+') + '_' + $scope.query.from;
                a.click();
            };

            $scope.aliases = index => {
                return index.name + (index.aliases.length ? ' [' + index.aliases + ']' : '');
            };

            $scope.search();
        }])

    .controller('bseDocumentCtrl', [
        '$scope',
        '$location',
        '$routeParams',
        'backstage.elasticizer.elasticsearch.Elasticsearch',
        'backstage.elasticizer.alerts.Alerts',
        function ($scope, $location, $routeParams, Elasticsearch, Alerts) {
            $scope.editorOptions = {
                lineWrapping: true,
                lineNumbers: true,
                smartIndent: true,
                height: 'auto',
                mode: 'javascript',
                theme: 'neo'
            };

            $scope.meta = {
                index: $routeParams.index,
                type: $routeParams.type,
                id: $routeParams.id
            };

            $scope.settings = {
                createAnother: false,
                bulkCreate: false
            };

            $scope.new = !$routeParams.id;
            $scope.elasticsearch = Elasticsearch;
            $scope.doc = {};

            $scope.save = () => {
                if (!$scope.meta.index) {
                    return Alerts.error('Index name is required');
                }

                if (!$scope.meta.type) {
                    return Alerts.error('Type name is required');
                }

                let body;

                try {
                    body = angular.fromJson($scope.doc.raw);
                } catch (err) {
                    Alerts.error(err.name + ': ' + err.message);
                }

                if (body) {
                    if ($scope.settings.bulkCreate) {
                        return $scope.bulkCreate(body);
                    }

                    Elasticsearch.client.index(angular.extend({body: body}, $scope.meta))
                        .then(res => {
                            Alerts.success('Document saved. The new version is: ' + res._version);
                            if (res.created) {
                                if ($scope.settings.createAnother) {
                                    $scope.doc = {};
                                } else {
                                    $location.path('/' + res._index + '/' + res._type + '/' + res._id);
                                }
                            } else {
                                $scope.doc._version = res._version;
                            }
                        })
                        .catch(err => {
                            Alerts.error(err);
                        });
                }
            };

            $scope.bulkCreate = docs => {
                let bulkData = [];

                if (!angular.isArray(docs) || !docs.length) {
                    return Alerts.error('The bulk create option needs a non-empty array of docs.');
                }

                docs.forEach(doc => {
                    bulkData.push({
                        index: {
                            _index: $scope.meta.index,
                            _type: $scope.meta.type
                        }
                    });
                    bulkData.push(doc);
                });

                Elasticsearch.client.bulk({body: bulkData, timeout: '600000ms'})
                    .then(res => {
                        if (!res.errors) {
                            Alerts.success(res.items.length + ' documents created.');
                        } else {
                            console.error(res);
                            Alerts.error('Something went wrong. See console log.');
                        }
                    })
                    .catch(err => {
                        Alerts.error(err);
                    });
            };

            $scope.reset = () => {
                $scope.doc.raw = angular.toJson($scope.doc._source, true);
            };

            if ($scope.meta.id) {
                Elasticsearch.client.get($scope.meta).then(res => {
                    $scope.doc = res;
                    $scope.doc.raw = angular.toJson(res._source, true);
                }).catch(err => {
                    Alerts.error(err);
                });
            }
        }
    ])

    .controller('bseBulkCtrl', [
        '$scope',
        '$q',
        '$location',
        '$routeParams',
        'backstage.elasticizer.elasticsearch.Elasticsearch',
        'backstage.elasticizer.alerts.Alerts',
        function ($scope, $q, $location, $routeParams, Elasticsearch, Alerts) {
            $scope.editorOptions = {
                lineWrapping: true,
                lineNumbers: true,
                smartIndent: true,
                height: 'auto',
                mode: 'javascript'
            };

            $scope.query = {
                index: $routeParams.index,
                type: $routeParams.type,
                q: $routeParams.q,
                mode: 'doc',
                scroll: '30s',
                size: 200,
                _source: false
            };

            $scope.doc = {};

            $scope.elasticsearch = Elasticsearch;

            // sets the content of doc.raw to a default value
            $scope.setRaw = () => {
                $scope.doc.raw = $scope.query.mode === 'doc' ? '{"key": "value"}' : '{"file":""}';
            };

            // set the default raw value when the scope is loaded
            $scope.setRaw();

            $scope.back = () => {
                $location.path('/search').search({
                    index: $scope.query.index,
                    type: $scope.query.type,
                    q: $scope.query.q
                });
            };

            $scope.update = () => {
                let body = '';
                let bulkData = [];

                $scope.doc.spinning = true;

                try {
                    body = angular.fromJson($scope.doc.raw);
                } catch (err) {
                    Alerts.error(err.name + ': ' + err.message);
                    $scope.doc.spinning = false;
                    throw err;
                }

                Elasticsearch.client
                    .search({...$scope.query, mode: undefined})
                    .then(res => {
                        return $q((resolve, reject) => {
                            function getMoreUntilDone(res) {
                                res.hits.hits.forEach(hit => {
                                    bulkData.push({
                                        update: {
                                            _index: hit._index,
                                            _type: hit._type,
                                            _id: hit._id
                                        }
                                    });

                                    let changes = {};
                                    changes[$scope.query.mode] = body;
                                    bulkData.push(changes);
                                });

                                if (res.hits.total !== bulkData.length / 2) {
                                    body = {
                                        scroll_id: res._scroll_id,
                                        scroll: '30s'
                                    };

                                    Elasticsearch.client
                                        .scroll({scrollId: JSON.stringify(body)})
                                        .then(getMoreUntilDone, reject);
                                } else {
                                    console.log('Scrolling done, ready to send bulk data', bulkData);
                                    resolve(bulkData);
                                }
                            }

                            getMoreUntilDone(res);
                        });
                    })
                    .then(bulkData => {
                        if (window.confirm('About to update ' + (bulkData.length / 2) + ' documents. Are you sure you want to proceed?')) {
                            return Elasticsearch.client.bulk({body: bulkData, timeout: '600000ms'}); // 10 min timeout
                        } else {
                            return $q.reject('Bulk update canceled.');
                        }
                    })
                    .then(res => {
                        console.log(res);
                        Alerts.success('Bulk update done.');
                    })
                    .catch(err => {
                        Alerts.error(err);
                    })
                    .finally(() => {
                        $scope.doc.spinning = false;
                    });
            };

        }
    ])

    .controller('bseAliasCtrl', [
        '$scope',
        'backstage.elasticizer.elasticsearch.Elasticsearch',
        'backstage.elasticizer.alerts.Alerts',
        function ($scope, Elasticsearch, Alerts) {
            $scope.elasticsearch = Elasticsearch;
            $scope.newAlias = {};
            $scope.trash = [];

            $scope.sortableOptions = {
                connectWith: '.aliases, .trash',
                remove: (event, ui) => {
                    console.log('delete alias', ui.item.text(), event.target.id);
                    $scope.deleteAlias(ui.item.text(), event.target.id);
                },
                receive: (event, ui) => {
                    console.log('put alias', ui.item.text(), event.target.id);
                    $scope.putAlias(ui.item.text(), event.target.id);
                }
            };

            $scope.trashOptions = {
                placeholder: '.trash-item',
                over: () => {
                    document.querySelector('.trash').classList.add('over');
                },
                out: () => {
                    document.querySelector('.trash').classList.remove('over');
                },
                items: null
            };

            $scope.putAlias = (name, index) => {
                return Elasticsearch.client.indices.putAlias({
                    name: name,
                    index: index
                }).then(() => {
                    Alerts.success('Alias added');
                }).catch(err => {
                    Alerts.error(err);
                });
            };

            $scope.deleteAlias = (name, index) => {
                return Elasticsearch.client.indices.deleteAlias({
                    name: name,
                    index: index
                }).then(() => {
                    Alerts.success('Alias removed');
                }).catch(err => {
                    Alerts.error(err);
                });
            };

            $scope.createAlias = (model, index) => {
                model.busy = true;
                $scope.putAlias(model.name, index.name).then(() => {
                    index.aliases.push(model.name);
                    model.busy = false;
                    model.name = null;
                });
            };

            $scope.refreshIndex = indexName => {
                Elasticsearch.client.indices.refresh({
                    index: indexName
                }).then(() => {
                    Alerts.success('Index refreshed');
                }).catch(err => {
                    Alerts.error(err);
                });
            };
        }
    ]);
