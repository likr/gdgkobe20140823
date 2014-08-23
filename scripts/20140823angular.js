var app = angular.module('app', ['ui.router']);

app.factory('getCSV', function($q) {
  return function(url, accessor) {
    var deferred = $q.defer();
    d3.csv(url, accessor, function(data) {
      deferred.resolve(data);
    });
    return deferred.promise;
  };
});

app.config(function($stateProvider, $urlRouterProvider) {
  $stateProvider
    .state('main', {
      controller: 'MainController',
      templateUrl: 'partials/main.html',
      url: '/',
      resolve: {
        scoreData: function(getCSV) {
          return getCSV('data/data.csv', function(row) {
            for (var attr in row) {
              row[attr] = +row[attr];
            }
            return row;
          });
        }
      }
    });

  $urlRouterProvider.otherwise('/');
});

app.filter('sumGame', function() {
  return function(game, keys) {
    return keys.reduce(function(sum, key) {
      return sum + game[key];
    }, 0);
  };
});

app.filter('sumTotal', function() {
  return function(data, key) {
    return data.reduce(function(sum, game) {
      return sum + game[key];
    }, 0);
  };
});

app.directive('chart', function() {
  return {
    restrict: 'EAC',
    scope: {
      keys: '=',
      values: '='
    },
    link: function(scope, element) {
      d3.select(element[0])
        .append('svg')
        .datum({
          keys: scope.keys,
          values: scope.values
        });

      scope.$watch('values', function() {
        d3.select('svg')
          .call(draw());
      }, true);
    }
  };

  function draw() {
    var verticalMargin = 30;
    var axisWidth = 50;
    var chartWidth = 500;
    var chartHeight = 400;
    var barWidth = 10;
    var colorScale = d3.scale.category10();

    return function(selection) {
      selection.each(function(data) {
        var svg = d3.select(this)
          .attr({
            width: chartWidth + axisWidth * 2,
            height: chartHeight + verticalMargin * 2
          });

        svg.selectAll('g.chart')
          .data([data])
          .enter()
          .call(initialize);

        svg.selectAll('g.chart')
          .call(drawBars)
          .call(drawLines);

        svg.selectAll('g.axis>path.domain')
          .style({
            fill: 'none',
            stroke: 'black'
          });
        svg.selectAll('g.axis>g.tick>line')
          .style('stroke', 'black');
      });
    };

    function initialize(selection) {
      var chart = selection
        .append('g')
        .classed('chart', true)
        .attr('transform', 'translate(' + axisWidth + ',' + (chartHeight / 2 + verticalMargin) + ')');

      chart.append('line')
        .attr({
          x1: 0,
          x2: chartWidth,
          y1: 0,
          y2: 0
        })
        .style({
          stroke: 'black'
        });

      chart.append('g')
        .classed('axis', true)
        .classed('left-axis', true);
      chart.append('g')
        .classed('axis', true)
        .classed('right-axis', true)
        .attr('transform', 'translate(' + chartWidth + ')');
    }

    function drawBars(selection) {
      selection.each(function(data) {
        var n = data.values.length;
        var keys = data.keys;
        var m = keys.length;

        var max = d3.max(data.values, function(game) {
          return d3.max(keys, function(key) {
            return game[key];
          });
        });
        var heightScale = d3.scale.linear()
          .domain([-max, max])
          .range([chartHeight / 2, -chartHeight / 2])
          .nice();

        selection.selectAll('g.game')
          .data(data.values)
          .enter()
          .append('g')
          .classed('game', true);
        var game = selection.selectAll('g.game');
        game.selectAll('rect.bar')
          .data(function(row) {
            return keys.map(function(key) {
              return row[key];
            });
          })
          .enter()
          .append('rect')
          .classed('bar', true)
          .attr({
            x: 0,
            y: 0,
            width: barWidth,
            height: 0,
          })
          .style('fill', function(d, i) {
            return colorScale(i);
          });

        game.selectAll('rect.bar')
          .attr('transform', function(d, i) {
            var t = 'translate(' + (i * barWidth) + ')';
            if (d >= 0) {
              t += 'rotate(180,' + (barWidth / 2) + ',0)';
            }
            return t;
          });

        var gameMargin = (chartWidth - barWidth * m * n) / (n + 1);
        var transition = selection.transition();
        transition.selectAll('g.game')
          .attr('transform', function(d, i) {
            var offset = (barWidth * m + gameMargin) * i + gameMargin;
            return 'translate(' + offset + ')';
          });
        transition.transition()
          .selectAll('rect.bar')
          .attr('height', function(d) {
            return -heightScale(Math.abs(d));
          });

        var leftAxis = d3.svg.axis()
          .scale(heightScale)
          .orient('left');
        selection.select('g.left-axis')
          .transition()
          .call(leftAxis);
      });
    }

    function drawLines(selection) {
      selection.each(function(data) {
        var n = data.values.length;
        var keys = data.keys;
        var m = keys.length;

        var lines = keys.map(function(key) {
          var line = data.values.map(function(game) {
            return +game[key];
          });
          for (var j = 1; j < n; ++j) {
            line[j] += line[j - 1];
          }
          return line;
        });
        var max = d3.max(lines, function(line) {
          return d3.max(line, Math.abs);
        });
        var heightScale = d3.scale.linear()
          .domain([-max, max])
          .range([chartHeight / 2, -chartHeight / 2])
          .nice();

        var gameMargin = (chartWidth - barWidth * m * n) / (n + 1);
        var line = d3.svg.line()
          .x(function(d, i) {
            return (barWidth * m + gameMargin) * i + gameMargin + barWidth * m / 2;
          })
          .y(function(d) {
            return heightScale(d);
          });

        selection.selectAll('path.line')
          .data(lines)
          .enter()
          .append('path')
          .classed('line', true)
          .style({
            fill: 'none',
            stroke: function(d, i) {
              return colorScale(i);
            }
          });
        selection.transition()
          .selectAll('path.line')
          .attr('d', function(l) {
            return line(l);
          });

        var rightAxis = d3.svg.axis()
          .scale(heightScale)
          .orient('right');
        selection.select('g.right-axis')
          .transition()
          .call(rightAxis);
      });
    }
  }
});

app.controller('MainController', function($scope, scoreData) {
  $scope.players = Object.keys(scoreData[0]);
  $scope.data = scoreData;

  $scope.add = function() {
    var game = {};
    $scope.players.forEach(function(player) {
      game[player] = 0;
    });
    $scope.data.push(game);
  };
});
