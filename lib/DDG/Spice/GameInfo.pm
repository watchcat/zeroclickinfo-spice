package DDG::Spice::GameInfo;

use DDG::Spice;
triggers startend => "game";
spice to => 'http://thefreegamesdb.com/API/DuckDuckGo.php?Name=$1';
spice wrap_jsonp_callback => 1;

primary_example_queries "homesick game";
description "See information about a free pc game";
name "GameInfo";
icon_url "/i/thefreegamesdb.com/favicon.ico";
source "thefreegamesdb";
topics "gaming";
category "reference";
attribution github => ['https://github.com/thomaspreece10','thomaspreece10'];


handle remainder => sub {
    return $_;
};


1;
