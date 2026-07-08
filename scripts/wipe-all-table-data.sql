-- WARNING: This permanently removes all rows from every base table
-- in the currently selected database.
--
-- Run only after selecting the correct database and taking a backup:
--   mysql -u root -p
--   USE skillforexport;
--   SOURCE scripts/wipe-all-table-data.sql;
--
-- Preserved seed/config tables:
--   community_categories
--   page_categories
--   advert_locations
--   advert_sites
--   legal_documents
--   migrations / knex migration tables

DROP PROCEDURE IF EXISTS wipe_all_table_data;

DELIMITER $$

CREATE PROCEDURE wipe_all_table_data()
BEGIN
  DECLARE done INT DEFAULT 0;
  DECLARE table_name_value VARCHAR(255);

  DECLARE table_cursor CURSOR FOR
    SELECT TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_TYPE = 'BASE TABLE'
      AND TABLE_NAME NOT IN (
        'community_categories',
        'page_categories',
        'advert_locations',
        'advert_sites',
        'legal_documents',
        'migrations',
        'knex_migrations',
        'knex_migrations_lock'
      );

  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

  SET FOREIGN_KEY_CHECKS = 0;

  OPEN table_cursor;

  read_loop: LOOP
    FETCH table_cursor INTO table_name_value;
    IF done = 1 THEN
      LEAVE read_loop;
    END IF;

    SET @truncate_sql = CONCAT('TRUNCATE TABLE `', REPLACE(table_name_value, '`', '``'), '`');
    PREPARE truncate_stmt FROM @truncate_sql;
    EXECUTE truncate_stmt;
    DEALLOCATE PREPARE truncate_stmt;
  END LOOP;

  CLOSE table_cursor;

  SET FOREIGN_KEY_CHECKS = 1;
END$$

DELIMITER ;

CALL wipe_all_table_data();

DROP PROCEDURE IF EXISTS wipe_all_table_data;
