use strict;
use warnings;
use Data::Dumper;
use feature 'signatures';

sub simple {
  # my @args = @_;
  print "this is simple\n";
  my $variable = 1;

  print $variable;
  return;
}

print "hello world!\n";

my $hello = "hello";

print $hello;

simple;
simple();
simple('hola');

sub foo : Expose ($left, $right) {
  return $left + $right;
}

foo();
print "\n";
my @chars = map chr, qw(1 2 3);
print "chars..." . Dumper \@chars;

map chr, qw(1 2 30);


my @meow = (2,3,2,45,43543,342,76);
my @array = grep 76 => @meow;

# map array function
map { $_*2 } @meow;

my %holidaymap = map { $_ . "day" => 1} @holidays;


map { $_ => 1 } @holidays;


sub hello {
    $_ => 1
}

if (1) {
    $_ => 1
}

$a++;

++$b;

{
	$a + 1;
    ++$b;
    $a++;
}

my $a = sub {
    my ($notedbh, $noteargs) = @_;
    push @noteinfo, $noteargs;
};


my %holidaymap = map { $_ . "day" => 1 } @holidays;

sub dfsdfs {
    return hello => 'sdff' && meos => 'dsfdf';
}

dfsdfs %holidaymap, $a if $a;

split /abc/, $meow;

# action sdfsd($dsf,$dsf) {
    
# }

method sdfsd($dsf,$dsf) {
    
}
