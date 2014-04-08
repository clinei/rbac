'use strict';

/**
 * Return middleware function for permission check
 * @param  {RBAC}    rbac      Instance of RBAC
 * @param  {String}  action    Name of action
 * @param  {String}  resource  Name of resource
 * @return {Function}          Middleware function
 */
exports.isAllowed = function(rbac, action, resource) {
	var permission = rbac.getPermission(action, resource);
	if(!permission) throw new Error('Permission is undefined');

	return function(req, res, next) {
		if(req.isAllowed && req.isAllowed(permission) === true) {
			next();
		}

		return next(new Error('You have no permission for this action'));
	};
};

/**
 * Return middleware function for permission check
 * @param  {RBAC}  rbac     Instance of RBAC
 * @param  {String}  name   Name of role
 * @return {Function}       Middleware function
 */
exports.hasRole = function(rbac, name) {
	var role = rbac.getRole(name);
	if(!role) throw new Error('Role is undefined');

	return function(req, res, next) {
		if(req.hasRole && req.hasRole(role) === true) {
			next();
		}

		return next(new Error('You have no permission for this action'));
	};
};