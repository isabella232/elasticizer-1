import module from './module';
import template from './templates/nav.html';

module.directive('bseNav', [
  'backstage.elasticizer.elasticsearch.Elasticsearch',
  function (Elasticsearch) {
    return {
      template: template,
      link: function ($scope) {
        $scope.elasticsearch = Elasticsearch;

        $scope.$on('$routeChangeSuccess', (event, current) => {
          $scope.route = current.$$route ? current.$$route.name : null;
        });
      }
    };
  }
]);
