module.exports = {
    catchError: require('rxjs/internal/operators/catchError').catchError,
    empty: require('rxjs/internal/observable/empty').empty,
    map: require('rxjs/internal/operators/map').map,
    mergeMap: require('rxjs/internal/operators/mergeMap').mergeMap,
    Observable: require('rxjs/internal/Observable').Observable,
    of: require('rxjs/internal/observable/of').of,
    pairs: require('rxjs/internal/observable/pairs').pairs,
    reduce: require('rxjs/internal/operators/reduce').reduce,
    throwError: require('rxjs/internal/observable/throwError').throwError
};