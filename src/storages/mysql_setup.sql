CREATE TABLE IF NOT EXISTS `items` (
    `id` INT AUTO_INCREMENT,
    `name` VARCHAR(64) UNIQUE NOT NULL,
    `is_role` BOOL NOT NULL,
    PRIMARY KEY (`id`)
);

CREATE TABLE IF NOT EXISTS `grants` (
    `parent_id` INT NOT NULL,
    `child_id` INT NOT NULL,
    PRIMARY KEY (`parent_id`, `child_id`),
    FOREIGN KEY (`parent_id`) REFERENCES `items` (`id`),
    FOREIGN KEY (`child_id`) REFERENCES `items` (`id`)
);

DROP PROCEDURE IF EXISTS `add`;
CREATE PROCEDURE `add` (IN itemName VARCHAR(64), IN is_role BOOL)
BEGIN
    SET @src = CONCAT(
    'INSERT IGNORE INTO `items` (`name`, `is_role`)',
    'VALUES ("', itemName, '", ', is_role, ');');
    PREPARE stmt FROM @src;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
END

DROP PROCEDURE IF EXISTS `remove`;
CREATE PROCEDURE `remove` (IN itemName VARCHAR(64))
BEGIN
    SET @src = CONCAT(
    'DELETE g FROM `grants` g ',
    'INNER JOIN `items` i ON `id` = `child_id` ',
    'WHERE `name` = "', itemName, '";');
    PREPARE stmt FROM @src;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;

    SET @src = CONCAT(
    'DELETE FROM `items` ',
    'WHERE `name` = "', itemName, '";');
    PREPARE stmt FROM @src;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
END

DROP PROCEDURE IF EXISTS `grant`;
CREATE PROCEDURE `grant` (IN parentName VARCHAR(64), IN childName VARCHAR(64))
BEGIN
    SET @src = CONCAT(
    'INSERT IGNORE INTO `grants` (`parent_id`, `child_id`)',
    'SELECT `parent`.`id`, `child`.`id` ',
    'FROM `items` AS `parent` ',
    'CROSS JOIN `items` AS `child` ',
    'WHERE `parent`.`name` = "', parentName, '" ',
    'AND `child`.`name` = "', childName, '" ');
    PREPARE stmt FROM @src;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
END

DROP PROCEDURE IF EXISTS `getRevoke`;
CREATE PROCEDURE `revoke` (IN parentName VARCHAR(64), IN childName VARCHAR(64))
BEGIN
    SET @src = CONCAT(
    'DELETE g.* FROM `grants` g ',
    'LEFT JOIN `items` i ON g.`parent_id` = i.`id` ',
    'LEFT JOIN `items` i2 ON g.`child_id` = i2.`id` ',
    'WHERE i.`name` = "', parentName, '" ',
    'AND i2.`name` = "', childName, '";');
    PREPARE stmt FROM @src;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
END

DROP PROCEDURE IF EXISTS `get`;
CREATE PROCEDURE `get` (IN itemName VARCHAR(64))
BEGIN
    SET @src = CONCAT(
    'SELECT * FROM `items` ',
    'WHERE `name` = "', itemName, '";');
    PREPARE stmt FROM @src;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
END

DROP PROCEDURE IF EXISTS `getPermissions`;
CREATE PROCEDURE `getPermissions` ()
BEGIN
/* TODO: collapse with getRoles */
    SET @src = CONCAT(
    'SELECT * FROM `items` ',
    'WHERE `is_role` = 0;');
    PREPARE stmt FROM @src;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
END

DROP PROCEDURE IF EXISTS `getRoles`;
CREATE PROCEDURE `getRoles` ()
BEGIN
    SET @src = CONCAT(
    'SELECT * FROM `items` ',
    'WHERE `is_role` = 1;');
    PREPARE stmt FROM @src;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
END

DROP PROCEDURE IF EXISTS `getGrants`;
CREATE PROCEDURE `getGrants`(IN itemName VARCHAR(64))
BEGIN
    SET @src = CONCAT(
    'SELECT i2.* FROM `items` i ',
    'LEFT JOIN `grants` g ON g.`parent_id` = i.`id` ',
    'INNER JOIN `items` i2 ON g.`child_id` = i2.`id` ',
    'WHERE i.`name` = "', itemName, '";');
    PREPARE stmt FROM @src;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
END
