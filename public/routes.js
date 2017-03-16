import uiRoutes from 'ui/routes';
import aliasesTemplate from './templates/aliases.html';
import bulkTemplate from './templates/bulk.html';
import documentTemplate from './templates/document.html';
import searchTemplate from './templates/search.html';

uiRoutes.enable();
uiRoutes
  .when('/', {
    redirectTo: '/search'
  })
  .when('/aliases', {
    template: aliasesTemplate,
    controller: 'bseAliasCtrl',
    name: 'aliases'
  })
  .when('/search', {
    template: searchTemplate,
    controller: 'bseSearchCtrl',
    reloadOnSearch: false,
    name: 'documents'
  })
  .when('/new', {
    template: documentTemplate,
    controller: 'bseDocumentCtrl',
    name: 'documents'
  })
  .when('/bulk', {
    template: bulkTemplate,
    controller: 'bseBulkCtrl',
    name: 'documents'
  })
  .when('/:index/:type/:id', {
    template: documentTemplate,
    controller: 'bseDocumentCtrl',
    name: 'documents'
  });
