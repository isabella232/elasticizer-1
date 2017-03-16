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

      ElasticsearchClient.indices.getAlias().then(function (res) {
        self.indices = res;
        self.indexMap = Object.keys(res).map(function (key) {
          return {
            name: key,
            aliases: Object.keys(res[key].aliases || {})
          };
        });
      });

      ElasticsearchClient.indices.getMapping().then(function (res) {
        self.mappings = res;
      });
    }
  ])

  .service('backstage.elasticizer.elasticsearch.Document', [
    '$q',
    'backstage.elasticizer.elasticsearch.Elasticsearch',
    'backstage.elasticizer.alerts.Alerts',
    function ($q, Elasticsearch, Alerts) {
      this.remove = function (document) {
        if (window.confirm('Are you sure you want to delete document ' + document._id + '?')) {
          return Elasticsearch.client.delete({
            index: document._index,
            type: document._type,
            id: document._id
          }).then(function () {
            Alerts.success('Document deleted.');
          }).catch(function (err) {
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
    function ($scope, $route, $routeParams, $location, Elasticsearch, Document) {
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

      $scope.search = function () {
        $scope.spinning = true;

        let query = angular.extend({}, $scope.query, {
          q: unEmpty($scope.query.q),
          from: ($scope.pagination.currentPage - 1) * $scope.query.size
        });

        Elasticsearch.client.search(query).then(function (res) {
          $scope.spinning = false;
          $scope.results = res;
        });

        $route.updateParams({from: query.from});
      };

      $scope.remove = function (doc, index) {
        Document.remove(doc).then(function () {
          $scope.results.hits.hits.splice(index, 1);
        });
      };

      $scope.new = function () {
        $location.path('/new').search({
          index: $scope.query.index,
          type: $scope.query.type
        });
      };

      $scope.bulk = function () {
        $location.path('/bulk').search({
          index: $scope.query.index,
          type: $scope.query.type,
          q: $scope.query.q
        });
      };

      $scope.export = function () {
        let data = $scope.results.hits.hits.map(function (hit) {
          return hit._source;
        });
        let blob = new Blob([angular.toJson(data, true)], {type: 'application/json'});
        let a = document.createElement('a');
        a.href = window.URL.createObjectURL(blob);
        a.download = ($scope.query.index || 'all-indices') + '_' + ($scope.query.type || 'all-types') + '_' +
          ($scope.query.q || 'no-query').replace(' ', '+') + '_' + $scope.query.from;
        a.click();
      };

      $scope.aliases = function (index) {
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
        mode: 'javascript'
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

      $scope.save = function () {
        if (!$scope.meta.index)
          return Alerts.error('Index name is required');

        if (!$scope.meta.type)
          return Alerts.error('Type name is required');

        let body;

        try {
          body = angular.fromJson($scope.doc.raw);
        } catch (err) {
          Alerts.error(err.name + ': ' + err.message);
        }

        if (body) {
          if ($scope.settings.bulkCreate)
            return $scope.bulkCreate(body);

          Elasticsearch.client.index(angular.extend({body: body}, $scope.meta))
            .then(function (res) {
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
            .catch(function (err) {
              Alerts.error(err);
            });
        }
      };

      $scope.bulkCreate = function (docs) {
        let bulkData = [];

        if (!angular.isArray(docs) || !docs.length)
          return Alerts.error('The bulk create option needs a non-empty array of docs.');

        docs.forEach(function (doc) {
          bulkData.push({
            index: {
              _index: $scope.meta.index,
              _type: $scope.meta.type
            }
          });
          bulkData.push(doc);
        });

        Elasticsearch.client.bulk({body: bulkData, timeout: '600000ms'})
          .then(function (res) {
            if (!res.errors) {
              Alerts.success(res.items.length + ' documents created.');
            } else {
              console.error(res);
              Alerts.error('Something went wrong. See console log.');
            }
          })
          .catch(function (err) {
            Alerts.error(err);
          });
      };

      $scope.reset = function () {
        $scope.doc.raw = angular.toJson($scope.doc._source, true);
      };

      if ($scope.meta.id) {
        Elasticsearch.client.get($scope.meta).then(function (res) {
          $scope.doc = res;
          $scope.doc.raw = angular.toJson(res._source, true);
        }).catch(function (err) {
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
      $scope.setRaw = function () {
        $scope.doc.raw = $scope.query.mode === 'doc' ? '{"key": "value"}' : '{"file":""}';
      };

      // set the default raw value when the scope is loaded
      $scope.setRaw();

      $scope.back = function () {
        $location.path('/search').search({
          index: $scope.query.index,
          type: $scope.query.type,
          q: $scope.query.q
        });
      };

      $scope.update = function () {
        let body = '', bulkData = [];

        $scope.doc.spinning = true;

        try {
          body = angular.fromJson($scope.doc.raw);
        } catch (err) {
          Alerts.error(err.name + ': ' + err.message);
          $scope.doc.spinning = false;
          throw err;
        }

        Elasticsearch.client.search({...$scope.query, mode: undefined})
          .then(function (res) {
            return $q(function (resolve) {
              (function getMoreUntilDone(res) {
                res.hits.hits.forEach(function (hit) {
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
                  // now we can call scroll over and over
                  Elasticsearch.client.scroll({
                    scrollId: res._scroll_id,
                    scroll: '30s'
                  }).then(getMoreUntilDone);
                } else {
                  console.log('Scrolling done, ready to send bulk data', bulkData);
                  resolve(bulkData);
                }
              })(res);
            });
          })
          .then(function (bulkData) {
            if (window.confirm('About to update ' + (bulkData.length / 2) + ' documents. Are you sure you want to proceed?')) {
              return Elasticsearch.client.bulk({body: bulkData, timeout: '600000ms'}); // 10 min timeout
            } else {
              return $q.reject('Bulk update canceled.');
            }
          })
          .then(function (res) {
            console.log(res);
            Alerts.success('Bulk update done.');
          })
          .catch(function (err) {
            Alerts.error(err);
          })
          .finally(function () {
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
        remove: function (event, ui) {
          console.log('delete alias', ui.item.text(), event.target.id);
          $scope.deleteAlias(ui.item.text(), event.target.id);
        },
        receive: function (event, ui) {
          console.log('put alias', ui.item.text(), event.target.id);
          $scope.putAlias(ui.item.text(), event.target.id);
        }
      };

      $scope.trashOptions = {
        placeholder: '.trash-item',
        over: function () {
          document.querySelector('.trash').classList.add('over');
        },
        out: function () {
          document.querySelector('.trash').classList.remove('over');
        },
        items: null
      };

      $scope.putAlias = function (name, index) {
        return Elasticsearch.client.indices.putAlias({
          name: name,
          index: index
        }).then(function () {
          Alerts.success('Alias added');
        }).catch(function (err) {
          Alerts.error(err);
        });
      };

      $scope.deleteAlias = function (name, index) {
        return Elasticsearch.client.indices.deleteAlias({
          name: name,
          index: index
        }).then(function () {
          Alerts.success('Alias removed');
        }).catch(function (err) {
          Alerts.error(err);
        });
      };

      $scope.createAlias = function (model, index) {
        model.busy = true;
        $scope.putAlias(model.name, index.name).then(function () {
          index.aliases.push(model.name);
          model.busy = false;
          model.name = null;
        });
      };

      $scope.refreshIndex = function (indexName) {
        Elasticsearch.client.indices.refresh({
          index: indexName
        }).then(function () {
          Alerts.success('Index refreshed');
        }).catch(function (err) {
          Alerts.error(err);
        });
      };
    }
  ]);
