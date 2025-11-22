#
# Project
#
package-lock.json:	package.json
	touch $@
node_modules:		package-lock.json
	npm install
	touch $@
build:			node_modules
use-local-%:
	npm uninstall @whi/$*
	npm install ../$*
use-npm-%:
	npm uninstall @whi/$*
	npm install @whi/$*
use-local-serious-error-types:
use-npm-serious-error-types:
use-local-authentic-codecs:
use-npm-authentic-codecs:
use-local-http:
use-npm-http:

use-local:		use-local-serious-error-types	use-local-authentic-codecs	use-local-http
use-npm:		  use-npm-serious-error-types	  use-npm-authentic-codecs	  use-npm-http


#
# Testing
#
TEST_SQLITE		= tests/testing.sqlite
TEST_COLLECTION		= tests/collection.json
MAGICAUTH_API_URL	?= https://dev.magicauth.ca
export MAGICAUTH_API_URL

test:			build test-setup
	npm test
test-debug:		build test-setup
	LOG_LEVEL=silly npm test

test-unit:		build test-setup
	npm test tests/unit
test-unit-debug:	build test-setup
	LOG_LEVEL=silly npm test tests/unit

test-integration:	build test-setup
	npm test tests/integration
test-integration-debug:	build test-setup
	LOG_LEVEL=silly npm test tests/integration

test-setup:		$(TEST_COLLECTION) $(TEST_SQLITE)
$(TEST_COLLECTION):
	curl -X POST "$(MAGICAUTH_API_URL)/collections" | jq . > $@
$(TEST_SQLITE):		tests/build.sql
	rm -f $@
	sqlite3 $@ < tests/build.sql
sqlite-interactive:
	sqlite3 -header -column $(TEST_SQLITE)


#
# Repository
#
clean-remove-chaff:
	@find . -name '*~' -exec rm {} \;
clean-files:		clean-remove-chaff
	git clean -nd
clean-files-force:	clean-remove-chaff
	git clean -fd
clean-files-all:	clean-remove-chaff
	git clean -ndx
clean-files-all-force:	clean-remove-chaff
	git clean -fdx


#
# NPM
#
preview-package:	clean-files test
	npm pack --dry-run .
create-package:		clean-files test
	npm pack .
publish-package:	clean-files test
	npm publish --access public .
