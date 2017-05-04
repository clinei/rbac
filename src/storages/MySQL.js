import * as mysql from 'mysql';
import Storage from './index';
import Permission from '../Permission';
import Role from '../Role';
import keymirror from 'keymirror';

/*
TODO: disallow parent_id = child_id
*/

// TODO: look into triggers and models

const init = `CREATE TABLE IF NOT EXISTS \`items\` (
    \`id\` INT AUTO_INCREMENT,
    \`name\` VARCHAR(64) UNIQUE NOT NULL,
    \`is_role\` BOOL NOT NULL,
    PRIMARY KEY (\`id\`)
);

CREATE TABLE IF NOT EXISTS \`grants\` (
    \`parent_id\` INT NOT NULL,
    \`child_id\` INT NOT NULL,
    PRIMARY KEY (\`parent_id\`, \`child_id\`),
    FOREIGN KEY (\`parent_id\`) REFERENCES \`items\` (\`id\`),
    FOREIGN KEY (\`child_id\`) REFERENCES \`items\` (\`id\`)
);

DROP PROCEDURE IF EXISTS \`add\`;
CREATE PROCEDURE \`add\` (IN itemName VARCHAR(64), IN is_role BOOL)
BEGIN
    SET @src = CONCAT(
    'INSERT IGNORE INTO \`items\` (\`name\`, \`is_role\`)',
    'VALUES ("', itemName, '", ', is_role, ');');
    PREPARE stmt FROM @src;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
END;

DROP PROCEDURE IF EXISTS \`remove\`;
CREATE PROCEDURE \`remove\` (IN itemName VARCHAR(64))
BEGIN
    SET @src = CONCAT(
    'DELETE g FROM \`grants\` g ',
    'INNER JOIN \`items\` i ON \`id\` = \`child_id\` ',
    'WHERE \`name\` = "', itemName, '";');
    PREPARE stmt FROM @src;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;

    SET @src = CONCAT(
    'DELETE FROM \`items\` ',
    'WHERE \`name\` = "', itemName, '";');
    PREPARE stmt FROM @src;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
END;

DROP PROCEDURE IF EXISTS \`grant\`;
CREATE PROCEDURE \`grant\` (IN parentName VARCHAR(64), IN childName VARCHAR(64))
BEGIN
    SET @src = CONCAT(
    'INSERT IGNORE INTO \`grants\` (\`parent_id\`, \`child_id\`)',
    'SELECT \`parent\`.\`id\`, \`child\`.\`id\` ',
    'FROM \`items\` AS \`parent\` ',
    'CROSS JOIN \`items\` AS \`child\` ',
    'WHERE \`parent\`.\`name\` = "', parentName, '" ',
    'AND \`child\`.\`name\` = "', childName, '" ');
    PREPARE stmt FROM @src;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
END;

DROP PROCEDURE IF EXISTS \`revoke\`;
CREATE PROCEDURE \`revoke\` (IN parentName VARCHAR(64), IN childName VARCHAR(64))
BEGIN
    SET @src = CONCAT(
    'DELETE g.* FROM \`grants\` g ',
    'LEFT JOIN \`items\` i ON g.\`parent_id\` = i.\`id\` ',
    'LEFT JOIN \`items\` i2 ON g.\`child_id\` = i2.\`id\` ',
    'WHERE i.\`name\` = "', parentName, '" ',
    'AND i2.\`name\` = "', childName, '";');
    PREPARE stmt FROM @src;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
END;

DROP PROCEDURE IF EXISTS \`get\`;
CREATE PROCEDURE \`get\` (IN itemName VARCHAR(64))
BEGIN
    SET @src = CONCAT(
    'SELECT * FROM \`items\` ',
    'WHERE \`name\` = "', itemName, '";');
    PREPARE stmt FROM @src;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
END;

DROP PROCEDURE IF EXISTS \`getPermissions\`;
CREATE PROCEDURE \`getPermissions\` ()
BEGIN
/* TODO: collapse with getRoles */
    SET @src = CONCAT(
    'SELECT * FROM \`items\` ',
    'WHERE \`is_role\` = 0;');
    PREPARE stmt FROM @src;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
END;

DROP PROCEDURE IF EXISTS \`getRoles\`;
CREATE PROCEDURE \`getRoles\` ()
BEGIN
    SET @src = CONCAT(
    'SELECT * FROM \`items\` ',
    'WHERE \`is_role\` = 1;');
    PREPARE stmt FROM @src;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
END;

DROP PROCEDURE IF EXISTS \`getGrants\`;
CREATE PROCEDURE \`getGrants\`(IN itemName VARCHAR(64))
BEGIN
    SET @src = CONCAT(
    'SELECT i2.* FROM \`items\` i ',
    'LEFT JOIN \`grants\` g ON g.\`parent_id\` = i.\`id\` ',
    'INNER JOIN \`items\` i2 ON g.\`child_id\` = i2.\`id\` ',
    'WHERE i.\`name\` = "', itemName, '";');
    PREPARE stmt FROM @src;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
END;
`;

export default class MySQLStorage extends Storage {
  constructor(arg1) {
    super();

    this._config = arg1;
    this._config.multipleStatements = true;
    this._connection = mysql.createConnection(this._config);
    this._connection.connect(function(err) {
      this._connection.query({
        sql: init
      }, function(err2) {
        if (err2) {
          console.log(err2);
        }
        // TODO: handle errors
      });
    }.bind(this));
  }

  add(item, cb) {
    const name = item.name;

    this._connection.query('CALL `add`(?, ?)', [name, item instanceof Role], function(err) {
      if (err) {
          cb(err, null);
      } else {
          cb(null, item);
      }
    });

    return this;
  }

  remove(item, cb) {
    const name = item.name;

    this._connection.query('CALL `remove`(?)', [name], function(err) {
        if (err) {
          cb(err, false);
        } else {
          cb(null, true);
        }
    });

    return this;
  }

  grant(role, child, cb) {
    if (!(role instanceof Role)) {
      return cb(new Error('`role` is not an instance of Role'));
    }

    if (!(child instanceof Role || child instanceof Permission)) {
      return cb(new Error('`child` is not an instance of Role or Permission'));
    }

    if (role.name === child.name) {
      return cb(new Error("Can't grant a role itself"));
    }

    this._connection.query('CALL `grant`(?, ?)', [role.name, child.name], function(err) {
      // TODO: error on role or child not exist in database
      if (err) {
          cb(err, false);
      } else {
          cb(null, true);
      }
    });

    return this;
  }

  revoke(role, child, cb) {
    this._connection.query('CALL `revoke`(?, ?)', [role.name, child.name], function(err) {
      // TODO: error on role or child not exist in database
      if (err) {
          cb(err, false);
      } else {
          cb(null, true);
      }
    });

    return this;
  }

  get(name, cb) {
    if (!name) {
      return cb(null, null);
    }

    this._connection.query('CALL `get`(?)', [name], function(err, results) {
      if (results && results[0].length) {
        this.getGrants(name, function(err, grants) {
          const converted = this._convertToInstance(results[0][0]);
          converted.grants = grants;
          cb(null, converted);
        }.bind(this));
      } else {
        cb(new Error('No rows returned'), null);
      }
    }.bind(this));

    return this;
  }

  getRoles(cb) {
    this._connection.query('CALL `getRoles`()', function(err, results) {
      if (results && results[0].length) {
        const items = [];
        results[0].forEach(function(row) {
          items.push(this._convertToInstance(row));
        }.bind(this));
        cb(null, items);
      } else {
        cb(new Error('No rows returned'), null);
      }
    }.bind(this));

    return this;
  }

  getPermissions(cb) {
    this._connection.query('CALL `getPermissions`()', function(err, results) {
      if (results && results[0].length) {
        const items = [];
        results[0].forEach(function(row) {
          items.push(this._convertToInstance(row));
        }.bind(this));
        cb(null, items);
      } else {
        cb(new Error('No rows returned'), null);
      }
    }.bind(this));

    return this;
  }

  getGrants(roleName, cb) {
    if (!roleName) {
      return cb(null, null);
    }

    this._connection.query('CALL `getGrants`(?)', [roleName], function(err, results) {
      if (results && results[0].length) {
        const items = [];
        results[0].forEach(function(row) {
          items.push(this._convertToInstance(row));
        }.bind(this));
        cb(null, items);
      } else {
        cb(new Error('No rows returned'), null);
      }
    }.bind(this));
  }

  _convertToInstance(record) {
    if (!record) {
      throw new Error('Record is undefined');
    }

    if (record.is_role) {
      return this.rbac.createRole(record.name, false, () => {});
    } else {
      const decoded = Permission.decodeName(record.name);
      if (!decoded) {
        throw new Error('Bad permission name');
      }

      return this.rbac.createPermission(decoded.action, decoded.resource, false, () => {});
    }

    throw new Error('Type is undefined');
  }
}
