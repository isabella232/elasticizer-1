import module from './module';
import template from './templates/alerts.html';

module
    .service('backstage.elasticizer.alerts.Alerts', [
        '$timeout',
        function ($timeout) {
            this.alerts = [];
            this.alert = function (msg, type) {
                let alert = {
                    msg: msg,
                    type: type,
                    closed: false
                };

                this.alerts.unshift(alert);

                // auto close
                $timeout(function () {
                    alert.closed = true;
                }, 10000);
            };
            this.success = function (msg) {
                this.alert(msg, 'success');
            };
            this.error = function (msg) {
                this.alert(msg, 'danger');
            };
        }
    ])

    .directive('bseAlerts', [
        'backstage.elasticizer.alerts.Alerts',
        function (Alerts) {
            return {
                template: template,
                link: function ($scope) {
                    $scope.alerts = Alerts.alerts;
                    $scope.closeAlert = function (idx) {
                        Alerts.alerts[idx].closed = true;
                    };
                }
            }

        }
    ]);
