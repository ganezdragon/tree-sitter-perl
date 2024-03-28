# hash needs its own sweet example file
use strict;
use warnings;
use Data::Dumper;

my $simple = SimpleModule->new();


my $event = {
  user_id => Data::UUID->new->Something($simple, {}),
};


my $output = {
  some_property => BaseModule::AtSomeWhere::GetSomething(121, {
      KEY => $var->{there},
  }),
};

my $ter = {
  first => 'something here',
  hello() ? (second => 1) : (third => 'ternary false'),
};

print Dumper $ter->{first};

# hash access
my %simple = (
  ones => 'one',
  twos => 'two'
);

print $simple{ones};

sub cake {
    return {
        name => "kjj",
    };
}

my $value = cake();

print "this is variable $value->{name}";

sub something {
    return 33333;
}

my @hash = (1, 2, 3 => 4, something, 3);