import module from './module';

module.constant('backstage.elasticizer.config.Config', {
  app: {
    buildInfo: '<%= pkg.version%>_<%= gitinfo.local.branch.current.name %>_<%= gitinfo.local.branch.current.shortSHA %>',
    buildDate: '<%= grunt.template.today("yyyymmdd") %>'
  },
  elasticsearch: {
    url: '/elasticsearch'
  }
});
