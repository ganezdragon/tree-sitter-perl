# *foo{SCALAR};

my $foo = "foo";

my $fooref = \$foo;

sub showem { { return @_ } }

# Anonymous sub
my $coderef = sub { print "Boink!\n" };

use Term::Cap;
my $terminal = Term::Cap->Tgetent( { OSPEED => 9600 });


$scalarref = $foo{SCALAR};
